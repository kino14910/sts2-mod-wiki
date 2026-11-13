"""Semantic regression tests; run: python -m unittest discover -s scripts/mod-extract -p test_parsers.py -v."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from config import ModConfig, entry_id
from parsers import load_table, parse_assembly


class AssemblyTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.assembly = self.root / 'arbitrary-assembly-layout'
        self.assembly.mkdir()
        self.cfg = ModConfig.load('fgo', source=str(self.root / 'pck-stage'))
        self.cfg.paths['localization'] = self.cfg.source / 'localization'
        self.images = {}

    def source(self, text, path='types.cs'):
        target = self.assembly / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('namespace Fgo.Scripts;\n' + text, encoding='utf-8')

    def locale(self, table, values):
        path = self.cfg.paths['localization'] / 'eng' / f'{table}.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(values), encoding='utf-8')

    def parse(self):
        return parse_assembly(self.cfg, self.assembly, self.images)

    def card(self, members='', base='CardModel', args='2, CardType.Attack, CardRarity.Rare, TargetType.AnyEnemy', *, expect_errors=False):
        self.source(f'public class Example : {base} {{ public Example() : base({args}) {{}} {members} }}')
        categories, diagnostics = self.parse()
        errors = [d for d in diagnostics if d['severity'] == 'error']
        self.assertEqual(bool(errors), expect_errors, diagnostics)
        return categories['cards'][0], diagnostics

    def test_ordinary_constructor_and_provenance(self):
        card, _ = self.card()
        self.assertEqual((card['cost'], card['type'], card['rarity']), (2, 'attack', 'rare'))
        self.assertEqual(card['provenance']['qualifiedType'], 'Fgo.Scripts.Example')
        self.assertEqual(len(card['provenance']['sha256']), 64)

    def test_noble_pool_uses_released_dll_registration_and_energy_color(self):
        # Reduced declarations from the released Fgo.dll: NobleCardModel and
        # NobleCardPool. Pool names are independent of rarity or folder names.
        self.source('''
            public class NobleCardPool : TypeListCardPoolModel {
              public override string EnergyColorName => "noble";
              public override bool IsColorless => false;
            }
            [RegisterCard(typeof(NobleCardPool), Inherit = true)]
            public abstract class NobleCardModel(int energyCost, CardType type, CardRarity rarity, TargetType targetType)
              : CardModel(energyCost, type, rarity, targetType) {
              public override CardPoolModel Pool => ModelDb.CardPool<NobleCardPool>();
              public override int MaxUpgradeLevel => 4;
            }
            public class Example() : NobleCardModel(2, CardType.Skill, CardRarity.Ancient, TargetType.Self) {}
        ''')
        categories, diagnostics = self.parse()
        self.assertFalse([d for d in diagnostics if d['severity'] == 'error'], diagnostics)
        card = categories['cards'][0]
        self.assertEqual((card['pool'], card['poolRef']), ('noble', 'NobleCardPool'))
        self.assertNotIn('color', card)

    def test_primary_constructor_parameter_forwarding_and_this_overload(self):
        self.source('''
            public abstract class Root(int cost, CardType type, CardRarity rarity, TargetType target)
              : CardModel(cost, type, rarity, target) {}
            public abstract class Intermediate : Root {
              protected Intermediate(int cost, CardType type, TargetType target)
                : this(cost, type, CardRarity.Uncommon, target) {}
              protected Intermediate(int cost, CardType type, CardRarity rarity, TargetType target)
                : base(cost, type, rarity, target) {}
            }
            public class Example() : Intermediate(3, CardType.Skill, TargetType.Self) {}
        ''', 'flat/decompiled.cs')
        categories, diagnostics = self.parse()
        self.assertEqual(len(categories['cards']), 1, diagnostics)
        card = categories['cards'][0]
        self.assertEqual((card['cost'], card['type'], card['rarity']), (3, 'skill', 'uncommon'))

    def test_optional_and_named_constructor_arguments(self):
        self.source('''
            public abstract class Base : CardModel {
              protected Base(int cost, CardType type, CardRarity rarity = CardRarity.Common)
                : base(cost, type, rarity, TargetType.Self) {}
            }
            public class Example() : Base(type: CardType.Skill, cost: 0) {}
        ''')
        categories, diagnostics = self.parse()
        self.assertEqual(categories['cards'][0]['rarity'], 'common', diagnostics)
        self.assertEqual(categories['cards'][0]['cost'], 0)

    def test_constructor_expression_substitution_preserves_precedence(self):
        self.source('''
          public abstract class Base(int cost) : CardModel(cost * 2, CardType.Skill, CardRarity.Common, TargetType.Self) {}
          public class Example() : Base(1 + 2) {}
        ''')
        categories, diagnostics = self.parse()
        self.assertEqual(categories['cards'][0]['cost'], 6, diagnostics)

    def test_numeric_enum_casts_use_verified_enum_members(self):
        card, _ = self.card(args='-1, (CardType)2, (CardRarity)3, (TargetType)1')
        self.assertEqual((card['cost'], card['type'], card['rarity']), (-1, 'skill', 'uncommon'))

    def test_unknown_rarity_is_an_error_and_never_uses_config_fallback(self):
        self.source('public class Unknown() : CardModel(1, CardType.Skill, (CardRarity)991, TargetType.Self) {}')
        categories, diagnostics = self.parse()
        self.assertEqual(categories['cards'], [])
        self.assertTrue(any(d['code'] == 'unknown_enum' and d['severity'] == 'error' for d in diagnostics))

    def test_unknown_cost_is_not_zero(self):
        self.source('public class Unknown() : CardModel(RuntimeCost(), CardType.Skill, CardRarity.Rare, TargetType.Self) {}')
        categories, diagnostics = self.parse()
        self.assertIsNone(categories['cards'][0]['cost'])
        self.assertTrue(any(d['code'] == 'unresolved_cost' for d in diagnostics))

    def test_custom_rarity_registration_is_resolved_without_guessing_numeric_values(self):
        self.source('''
            public static class ModEnums {
              public static CardRarity Special;
              public static void Initialize() {
                Special = Framework.RegisterDynamicEnumValue<CardRarity>("X", "Special");
              }
            }
            public class Example() : CardModel(2, CardType.Power, ModEnums.Special, TargetType.Self) {}
        ''')
        categories, diagnostics = self.parse()
        self.assertEqual(categories['cards'][0]['rarity'], 'Special', diagnostics)

    def test_ilspy_readonly_arrays_and_named_generic_variables_preserve_raw_values(self):
        card, _ = self.card('''
            protected override IEnumerable<DynamicVar> CanonicalVars =>
              new global::_003C_003Ez__ReadOnlyArray<DynamicVar>(new DynamicVar[3] {
                ModCardVars.Damage(6m),
                new PowerVar<WeakPower>("NamedWeak", 2m),
                ModCardVars.Int("percentMore", 1.25m)
              });
        ''')
        self.assertEqual(card['variables'], {'Damage': 6, 'NamedWeak': 2, 'percentMore': 1.25})
        self.assertEqual(card['variableMetadata']['percentMore']['valueType'], 'decimal')
        self.assertIn('1.25m', card['variableMetadata']['percentMore']['expression'])
        self.assertEqual(card['variableMetadata']['NamedWeak']['type'], 'PowerVar<WeakPower>')

    def test_single_element_and_getter_collections(self):
        card, _ = self.card('''
          protected override IEnumerable<DynamicVar> CanonicalVars {
            get { DynamicVar[] values = new DynamicVar[1] { ModCardVars.Heal(7m) };
              return new ReadOnlyArray<DynamicVar>(values); }
          }
        ''')
        self.assertEqual(card['variables'], {'Heal': 7})

    def test_cooldown_composition_resolves_concrete_property_and_additional_vars(self):
        self.source('''
            public abstract class Cooldown(int cost) : CardModel(cost, CardType.Skill, CardRarity.Common, TargetType.Self) {
              public abstract int CooldownMax { get; }
              protected sealed override IEnumerable<DynamicVar> CanonicalVars =>
                AdditionalCanonicalVars.Prepend(ModCardVars.Int("CooldownMax", (decimal)CooldownMax));
              protected virtual IEnumerable<DynamicVar> AdditionalCanonicalVars => Array.Empty<DynamicVar>();
            }
            public class Example() : Cooldown(1) {
              public override int CooldownMax => 3;
              protected override IEnumerable<DynamicVar> AdditionalCanonicalVars => [ModCardVars.Block(5m)];
            }
        ''')
        categories, diagnostics = self.parse()
        self.assertEqual(categories['cards'][0]['variables'], {'CooldownMax': 3, 'Block': 5}, diagnostics)

    def test_virtual_collections_replace_base_values_instead_of_unioning(self):
        self.source('''
            public abstract class Parent() : CardModel(1, CardType.Skill, CardRarity.Common, TargetType.Self) {
              protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Block(5m)];
              public override IEnumerable<CardKeyword> CanonicalKeywords => [CardKeyword.Retain];
            }
            public class Example : Parent {
              protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Damage(6m)];
              public override IEnumerable<CardKeyword> CanonicalKeywords => [CardKeyword.Exhaust];
            }
        ''')
        categories, diagnostics = self.parse()
        self.assertEqual(categories['cards'][0]['variables'], {'Damage': 6}, diagnostics)
        self.assertEqual(categories['cards'][0]['keywords'], ['Exhaust'])

    def test_constants_property_field_and_arithmetic(self):
        card, _ = self.card('''
            private const string Key = "Block";
            private const int BaseAmount = 3;
            private int _amount = 7;
            public int CurrentAmount { get { return _amount; } }
            protected override IEnumerable<DynamicVar> CanonicalVars =>
              [ModCardVars.Int(Key, BaseAmount * 2), ModCardVars.Int("Current", CurrentAmount)];
        ''')
        self.assertEqual(card['variables'], {'Block': 6, 'Current': 7})

    def test_unknown_variable_is_omitted_with_expression_diagnostic(self):
        card, diagnostics = self.card('''
          protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Int("Damage", RuntimeAmount)];
          public int Preview => DynamicVars["NotDeclared"].IntValue;
        ''')
        self.assertEqual(card['variables'], {})
        self.assertTrue(card['variableMetadata']['Damage']['unresolved'])
        self.assertTrue(any(d['code'] == 'unresolved_variable' for d in diagnostics))
        self.assertNotIn('NotDeclared', card['variables'])

    def test_unknown_variable_type_and_integer_division_are_not_guessed(self):
        card, diagnostics = self.card('''
          protected override IEnumerable<DynamicVar> CanonicalVars => [
            new StrangeVar(5m), ModCardVars.Int("Ratio", 3 / 2)
          ];
        ''')
        self.assertEqual(card['variables'], {})
        self.assertTrue(any(d['code'] == 'unsupported_variable_type' for d in diagnostics))
        self.assertTrue(any(d['code'] == 'unresolved_variable' for d in diagnostics))

    def test_constructor_assigned_field_is_not_assumed_to_have_clr_zero_value(self):
        self.source('''
          public class Example : CardModel {
            private int _amount;
            public int Amount => _amount;
            public Example() : base(1, CardType.Skill, CardRarity.Common, TargetType.Self) { _amount = Runtime(); }
            protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Int("Amount", Amount)];
          }
        ''')
        categories, diagnostics = self.parse()
        self.assertEqual(categories['cards'][0]['variables'], {})
        self.assertTrue(any(d['code'] == 'unresolved_variable' for d in diagnostics))

    def test_numeric_keywords_and_runtime_cost_overrides(self):
        card, diagnostics = self.card('''
            public override IEnumerable<CardKeyword> CanonicalKeywords => new ReadOnlySingleElementList<CardKeyword>((CardKeyword)1);
            protected override int CanonicalEnergyCost { get { if (RuntimeSetting) return -1; return 2; } }
        ''')
        self.assertEqual(card['keywords'], ['Exhaust'])
        self.assertEqual(card['cost'], 2)
        self.assertIn('cost', card['runtimeOverrides'])
        self.assertTrue(any(d.get('field') == 'CanonicalEnergyCost' for d in diagnostics))

    def test_computed_overloads_have_declared_base_values_and_keep_runtime_formula(self):
        card, diagnostics = self.card('''
          protected override IEnumerable<DynamicVar> CanonicalVars => [
            ModCardVars.Computed("ByFactory", (ComputedDynamicVarFactory)factory, 5m),
            ModCardVars.Computed("ByFunc", 2m, card => card.Owner.CurrentHp),
            ModCardVars.ComputedEnergy("Default", (ComputedDynamicVarContext ctx) => ctx.BaseValue + 100m)
          ];
        ''')
        self.assertEqual(card['variables'], {'ByFactory': 5, 'ByFunc': 2, 'Default': 0})
        self.assertTrue(card['variableMetadata']['Default']['computed'])
        self.assertFalse(any(d['code'] == 'unresolved_variable' for d in diagnostics))

    def test_optional_string_default_is_known_signature_evidence(self):
        card, _ = self.card('protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.String("Name")];')
        self.assertEqual(card['variables'], {'Name': ''})

    def test_upgrade_aliases_cost_and_keywords(self):
        card, _ = self.card('''
            protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Power<DoomPower>(12m)];
            public override IEnumerable<CardKeyword> CanonicalKeywords => [CardKeyword.Exhaust];
            protected override void OnUpgrade() {
              ((CardModel)(object)this).DynamicVars.Doom.UpgradeValueBy(2m);
              EnergyCost.UpgradeBy(-1);
              RemoveKeyword(CardKeyword.Exhaust);
              AddKeyword(CardKeyword.Innate);
            }
        ''')
        self.assertEqual(card['upgrade'], {'variables': {'DoomPower': 14}, 'cost': 1, 'keywords': ['Innate']})

    def test_upgrade_missing_base_value_does_not_turn_delta_into_absolute_value(self):
        card, diagnostics = self.card('protected override void OnUpgrade() { DynamicVars.Damage.UpgradeValueBy(9m); }', expect_errors=True)
        self.assertNotIn('upgrade', card)
        self.assertTrue(any(d['code'] == 'unresolved_upgrade' for d in diagnostics))

    def test_conditional_upgrade_is_reported_without_applying_both_branches(self):
        card, diagnostics = self.card('protected override void OnUpgrade() { if (State) EnergyCost.UpgradeBy(-1); }', expect_errors=True)
        self.assertNotIn('upgrade', card)
        self.assertTrue(any(d['code'] == 'conditional_upgrade' for d in diagnostics))
        self.assertTrue(any(d['severity'] == 'error' for d in diagnostics))
        self.assertEqual(card['upgradeLevels'], [])
        self.assertEqual(card['upgradeMetadata']['status'], 'unresolved')

    def test_upgrade_assignments_read_current_values_and_keep_statement_order(self):
        card, _ = self.card('''
          protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Damage(3m), ModCardVars.Block(2m)];
          protected override void OnUpgrade() {
            DynamicVars.Damage.BaseValue = 10m;
            DynamicVars.Damage.UpgradeValueBy(2m);
            DynamicVars.Block.BaseValue = DynamicVars.Damage.BaseValue * 2;
            DynamicVars.Damage.BaseValue += 3m;
            DynamicVars.Damage.BaseValue -= 1m;
            DynamicVars.Damage.BaseValue *= 2m;
          }
        ''')
        self.assertEqual(card['upgrade']['variables'], {'Damage': 28, 'Block': 24})
        self.assertEqual(card['upgradeLevels'][0]['patch'], card['upgrade'])

    def test_upgrade_base_call_runs_at_its_actual_position(self):
        for body, expected in [
            ('DynamicVars.Damage.UpgradeValueTo(10); base.OnUpgrade();', 12),
            ('base.OnUpgrade(); DynamicVars.Damage.UpgradeValueTo(10);', 10),
            ('base.OnUpgrade(); DynamicVars.Damage.BaseValue *= 2; base.OnUpgrade();', 12),
        ]:
            with self.subTest(body=body):
                self.source('''
                  public abstract class Parent() : CardModel(1, CardType.Attack, CardRarity.Common, TargetType.Self) {
                    protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Damage(3m)];
                    protected override void OnUpgrade() { DynamicVars.Damage.UpgradeValueBy(2); }
                  }
                  public class Example : Parent {
                    protected override void OnUpgrade() { ''' + body + ''' }
                  }
                ''')
                categories, diagnostics = self.parse()
                self.assertEqual(categories['cards'][0]['upgrade']['variables']['Damage'], expected, diagnostics)
                self.assertFalse([d for d in diagnostics if d['severity'] == 'error'])

    def test_upgrade_external_game_base_call_is_verified_noop(self):
        card, _ = self.card('''
          protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Damage(3m)];
          protected override void OnUpgrade() { base.OnUpgrade(); DynamicVars.Damage.UpgradeValueBy(2); }
        ''')
        self.assertEqual(card['upgrade']['variables']['Damage'], 5)

    def test_upgrade_control_flow_nested_and_unreachable_statements_fail_closed(self):
        bodies = [
            'return; DynamicVars.Damage.UpgradeValueBy(9);',
            'throw new Exception(); DynamicVars.Damage.UpgradeValueBy(9);',
            'try { DynamicVars.Damage.UpgradeValueBy(9); } finally {}',
            'void Later() { DynamicVars.Damage.UpgradeValueBy(9); }',
            'Action later = () => DynamicVars.Damage.UpgradeValueBy(9);',
            'DynamicVars.Damage.BaseValue = State ? 3 : 9;',
            'goto End; DynamicVars.Damage.UpgradeValueBy(9); End: ;',
            'DynamicVars.Damage.UpgradeValueBy(2); UnknownHelper();',
            'DynamicVars.Damage.BaseValue = (int)1.9m;',
            'Other.DynamicVars.Damage.UpgradeValueBy(9);',
            'privateDamage = 9;',
        ]
        for body in bodies:
            with self.subTest(body=body):
                self.source('''public class Example() : CardModel(2, CardType.Attack, CardRarity.Common, TargetType.Self) {
                  protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Damage(3m)];
                  protected override void OnUpgrade() { ''' + body + ''' }
                }''')
                categories, diagnostics = self.parse()
                card = categories['cards'][0]
                self.assertNotIn('upgrade', card)
                self.assertEqual(card['upgradeLevels'], [])
                self.assertTrue(any(d['severity'] == 'error' for d in diagnostics), diagnostics)

    def test_upgrade_does_not_execute_other_methods_or_string_contents(self):
        card, _ = self.card('''
          protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Int("if;return", 3m)];
          protected override void OnUpgrade() { DynamicVars["if;return"].BaseValue = 4m; }
          public void Other() { DynamicVars["if;return"].UpgradeValueBy(100); }
        ''')
        self.assertEqual(card['upgrade']['variables'], {'if;return': 4})

    def test_upgrade_receiver_normalization_preserves_literal_variable_names(self):
        card, _ = self.card('''
          protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Int("base.DynamicVars.Damage", 3m)];
          protected override void OnUpgrade() { base.DynamicVars["base.DynamicVars.Damage"].BaseValue = 4m; }
        ''')
        self.assertEqual(card['upgrade']['variables'], {'base.DynamicVars.Damage': 4})

    def test_cost_levels_follow_verified_energy_clamp_and_star_api(self):
        card, _ = self.card('''
          public override int MaxUpgradeLevel => 3;
          public override int CanonicalStarCost => 4;
          protected override void OnUpgrade() { EnergyCost.UpgradeBy(-1); UpgradeStarCostBy(-1); }
        ''')
        self.assertEqual([r['patch']['cost'] for r in card['upgradeLevels']], [1, 0, 0])
        self.assertEqual([r['patch']['secondEnergy'] for r in card['upgradeLevels']], [3, 2, 1])
        card, _ = self.card('''
          public override bool HasEnergyCostX => true;
          protected override void OnUpgrade() { EnergyCost.UpgradeBy(-1); }
        ''')
        self.assertEqual(card['cost'], 'X')
        self.assertEqual(card['upgradeLevels'][0]['patch'], {})

    def test_multilevel_upgrades_are_absolute_cumulative_patches(self):
        card, _ = self.card('''
          public override int MaxUpgradeLevel => 4;
          protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Damage(3m)];
          protected override void OnUpgrade() { DynamicVars.Damage.UpgradeValueBy(2m); }
        ''')
        self.assertEqual(card['maxUpgradeLevel'], 4)
        self.assertEqual(card['upgrade']['variables']['Damage'], 5)
        self.assertEqual([r['patch']['variables']['Damage'] for r in card['upgradeLevels']], [5, 7, 9, 11])
        self.assertEqual([r['level'] for r in card['upgradeLevels']], [1, 2, 3, 4])
        self.assertTrue(all(r['verified'] for r in card['upgradeLevels']))
        self.assertEqual(card['upgradeMetadata']['verifiedThrough'], 4)
        self.assertEqual(card['upgradeMetadata']['patchSemantics'], 'absolute-from-base')

    def test_multilevel_runtime_level_is_incremented_before_upgrade(self):
        card, _ = self.card('''
          public override int MaxUpgradeLevel => 3;
          protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Damage(3m)];
          protected override void OnUpgrade() { DynamicVars.Damage.BaseValue += CurrentUpgradeLevel; }
        ''')
        self.assertEqual([r['patch']['variables']['Damage'] for r in card['upgradeLevels']], [4, 6, 9])

    def test_live_power_mutation_is_recorded_without_changing_card_twice(self):
        self.source('''
          public class LivePower : PowerModel {
            public override PowerType Type => PowerType.Buff;
            public override PowerStackType StackType => PowerStackType.Counter;
          }
          public class Example() : CardModel(1, CardType.Skill, CardRarity.Common, TargetType.Self) {
            private LivePower? _power;
            public override int MaxUpgradeLevel => 2;
            protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Int("DamageReduction", 50m)];
            protected override void OnUpgrade() {
              _power?.DynamicVars["DamageReduction"].UpgradeValueBy(-15m);
              DynamicVars["DamageReduction"].UpgradeValueBy(-15m);
            }
          }
        ''')
        categories, diagnostics = self.parse()
        card = categories['cards'][0]
        self.assertFalse([d for d in diagnostics if d['severity'] == 'error'], diagnostics)
        self.assertEqual([r['patch']['variables']['DamageReduction'] for r in card['upgradeLevels']], [35, 20])
        effects = card['upgradeMetadata']['runtimeEffects']
        self.assertEqual([e['level'] for e in effects], [1, 2])
        self.assertEqual(effects[0]['qualifiedType'], 'Fgo.Scripts.LivePower')
        self.assertEqual(effects[0]['operand'], -15)
        self.assertFalse(effects[0]['evaluated'])
        self.assertTrue(any(d['code'] == 'runtime_upgrade_effect' for d in diagnostics))

    def test_untyped_conditional_receiver_is_an_error(self):
        card, diagnostics = self.card('''
          private object _power;
          protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.Damage(3m)];
          protected override void OnUpgrade() { _power?.DynamicVars.Damage.UpgradeValueBy(2m); }
        ''', expect_errors=True)
        self.assertEqual(card['upgradeLevels'], [])
        self.assertTrue(any(d['code'] == 'unresolved_upgrade' for d in diagnostics))

    def test_default_zero_and_unresolved_upgrade_limits_are_explicit(self):
        card, _ = self.card()
        self.assertEqual(card['maxUpgradeLevel'], 1)
        self.assertEqual(card['inheritedFields']['maxUpgradeLevel']['value'], 1)
        self.assertEqual(card['upgradeLevels'], [{'level': 1, 'patch': {}, 'verified': True}])
        card, _ = self.card('public override int MaxUpgradeLevel => 0;')
        self.assertEqual(card['upgradeLevels'], [])
        self.assertEqual(card['upgradeMetadata']['status'], 'complete')
        self.source('''public class Example() : CardModel(1, CardType.Skill, CardRarity.Common, TargetType.Self) {
          public override int MaxUpgradeLevel => RuntimeLimit;
        }''')
        categories, diagnostics = self.parse()
        self.assertNotIn('maxUpgradeLevel', categories['cards'][0])
        self.assertEqual(categories['cards'][0]['upgradeMetadata']['status'], 'unresolved')
        self.assertTrue(any(d['code'] == 'unresolved_upgrade_limit' and d['severity'] == 'error' for d in diagnostics))

    def test_refs_identify_declaring_member_and_never_claim_gameplay_effect(self):
        self.source('''
          public abstract class Parent() : CardModel(1, CardType.Attack, CardRarity.Common, TargetType.Self) {
            public void Helper() { HasPower<StrengthPower>(); }
          }
          public class Example : Parent {
            public void Preview() { HoverTipFactory.FromPower<StrengthPower>(); }
            public string Text => "PowerCmd.Apply<NotRealPower>()";
          }
        ''')
        categories, diagnostics = self.parse()
        refs = categories['cards'][0]['refs']
        self.assertEqual(len(refs), 1, diagnostics)
        self.assertEqual(refs[0]['kind'], 'power')
        self.assertEqual(refs[0]['relationKind'], 'declaration-reference')
        self.assertEqual({s['member'] for s in refs[0]['sources']}, {'Preview', 'Helper'})
        inherited = next(s for s in refs[0]['sources'] if s['member'] == 'Helper')
        self.assertTrue(inherited['inherited'])
        self.assertEqual(inherited['qualifiedType'], 'Fgo.Scripts.Parent')
        self.assertGreater(inherited['line'], 0)

    def test_relic_potion_and_inherited_power_fields(self):
        self.source('''
            public abstract class RelicBase : RelicModel { public override RelicRarity Rarity => RelicRarity.Shop; }
            public class Trinket : RelicBase {}
            public class Brew : PotionModel {
              public override PotionRarity Rarity => PotionRarity.Uncommon;
              public override PotionUsage Usage => PotionUsage.CombatOnly;
              public override TargetType TargetType => TargetType.AnyEnemy;
              protected override IEnumerable<DynamicVar> CanonicalVars => [new IntVar("Amount", 2m)];
            }
            public abstract class PowerBase : PowerModel {
              public override PowerType Type => PowerType.Debuff;
              public override PowerStackType StackType => PowerStackType.Single;
            }
            public class Effect : PowerBase {}
        ''')
        categories, diagnostics = self.parse()
        self.assertEqual(categories['relics'][0]['rarity'], 'shop', diagnostics)
        self.assertEqual(categories['potions'][0]['variables'], {'Amount': 2})
        self.assertEqual(categories['potions'][0]['usage'], 'CombatOnly')
        self.assertEqual(categories['powers'][0]['stack'], 'Single')

    def test_characters_and_additive_starter_counts(self):
        self.source('''
            [RegisterCharacterStarterCard(typeof(Hero), 4)]
            public class Strike() : CardModel(1, CardType.Attack, CardRarity.Basic, TargetType.AnyEnemy) {}
            [RegisterCharacterStarterRelic(typeof(Hero), 1)]
            public class Locket : RelicModel { public override RelicRarity Rarity => RelicRarity.Starter; }
            [RegisterCharacter]
            public class Hero : ModCharacterTemplate<CustomCards, CustomRelics, CustomPotions> {
              public override int StartingHp => 72;
              public override int StartingGold => 99;
              public override int MaxEnergy => 4;
              public override CharacterGender Gender => CharacterGender.Feminine;
            }
        ''')
        categories, diagnostics = self.parse()
        hero = categories['characters'][0]
        self.assertEqual(hero['startingDeck'], ['Strike'] * 4, diagnostics)
        self.assertEqual(hero['startingRelics'], ['Locket'])
        self.assertEqual((hero['startingHp'], hero['maxEnergy'], hero['cardPoolRef']), (72, 4, 'CustomCards'))
        self.assertEqual(hero['localizationId'], 'FGO_CHARACTER_HERO')

    def test_text_aliases_for_generic_temporary_powers_and_origin_card(self):
        self.source('''
            public abstract class Temporary<T> : ModTemporaryAppliedPowerTemplate<T, StrengthPower> {
              public override LocString Description => new LocString("powers", IsPositive ? "TEMPORARY_STRENGTH_POWER.description" : "TEMPORARY_STRENGTH_DOWN.description");
            }
            public class Effect : Temporary<Origin> { protected override bool IsPositive => false; }
        ''')
        self.locale('cards', {'FGO_CARD_ORIGIN.title': 'Origin title'})
        categories, diagnostics = self.parse()
        power = categories['powers'][0]
        self.assertEqual(power['group'], 'Debuff', diagnostics)
        self.assertEqual(power['localizationRefs']['title']['key'], 'FGO_CARD_ORIGIN.title')
        self.assertEqual(power['localizationRefs']['description']['key'], 'TEMPORARY_STRENGTH_DOWN.description')
        self.assertEqual(power['localizationStatus'], 'external')

    def test_unknown_dependency_override_does_not_use_verified_default(self):
        self.source('''
          public class Effect : ModTemporaryAppliedPowerTemplate<Origin, StrengthPower> {
            protected override bool IsPositive => RuntimeSetting;
          }
          public class Hero : ModCharacterTemplate<Cards, Relics, Potions> {
            public override int StartingHp => 50;
            public override int StartingGold => 99;
            public override int MaxEnergy => RuntimeEnergy;
          }
        ''')
        categories, diagnostics = self.parse()
        self.assertNotIn('group', categories['powers'][0])
        self.assertNotIn('maxEnergy', categories['characters'][0])
        self.assertTrue(any(d['code'] == 'unresolved_character_field' for d in diagnostics))

    def test_hidden_and_missing_translation_models_are_retained_and_diagnosed(self):
        self.source('''
            public class Hidden : PowerModel {
              protected override bool IsVisibleInternal => false;
              public override PowerType Type => PowerType.Buff;
              public override PowerStackType StackType => PowerStackType.Single;
            }
            public class Missing : PowerModel {
              public override PowerType Type => PowerType.Debuff;
              public override PowerStackType StackType => PowerStackType.Counter;
            }
        ''')
        self.locale('powers', {})
        categories, diagnostics = self.parse()
        self.assertEqual([p['localizationStatus'] for p in categories['powers']], ['hidden', 'missing'])
        self.assertTrue(any(d['code'] == 'hidden_model_localization' for d in diagnostics))
        self.assertTrue(any(d['code'] == 'missing_localization' for d in diagnostics))

    def test_resource_paths_and_supplied_image_index(self):
        self.images = {'cards': {'shared': 'images/cards/shared.webp.png'}}
        card, _ = self.card('''public override CardAssetProfile AssetProfile {
          get { string name = GetType().Name;
            return new CardAssetProfile("res://Fgo/images/cards/shared.png", "res://Fgo/images/cards/" + name + ".png"); }
        }''')
        self.assertEqual(card['image'], 'images/cards/shared.webp.png')
        self.assertIn('res://Fgo/images/cards/Example.png', card['resourceRefs'])

    def test_braces_and_commas_in_strings_do_not_break_collection_scanning(self):
        card, _ = self.card('''
            protected override IEnumerable<DynamicVar> CanonicalVars => [ModCardVars.String("Text", "x, { y } // z")];
        ''')
        self.assertEqual(card['variables']['Text'], 'x, { y } // z')

    def test_localization_tables_follow_stage_changes_without_mod_id_cache(self):
        self.locale('cards', {'A': 'old'})
        self.assertEqual(load_table(self.cfg, 'cards', 'eng')['A'], 'old')
        self.locale('cards', {'A': 'new'})
        self.assertEqual(load_table(self.cfg, 'cards', 'eng')['A'], 'new')

    def test_duplicate_ids_are_not_silently_overwritten(self):
        self.source('public class Duplicate() : CardModel(1, CardType.Attack, CardRarity.Basic, TargetType.Self) {}')
        (self.assembly / 'other.cs').write_text('namespace Fgo.Scripts.Other; public class Duplicate() : CardModel(2, CardType.Skill, CardRarity.Common, TargetType.Self) {}', encoding='utf-8')
        categories, diagnostics = self.parse()
        self.assertEqual(len(categories['cards']), 1)
        self.assertTrue(any(d['code'] == 'duplicate_entity_id' and d['severity'] == 'error' for d in diagnostics))

    def test_no_fixed_source_layout_and_no_missing_root_success(self):
        self.assertRaises(FileNotFoundError, parse_assembly, self.cfg, self.assembly / 'absent', {})
        self.assertEqual(set(self.parse()[0]), {'cards', 'relics', 'potions', 'powers', 'characters'})


class ActualBuildTests(unittest.TestCase):
    """Optional local evidence check, in addition to portable semantic fixtures."""

    def test_resolved_real_assembly(self):
        project = Path(__file__).resolve().parents[2]
        root = project / '.cache/mod-import/resolved-full'
        locale = project / '.cache/mod-import/resource-probe/localization'
        if not root.is_dir() or not locale.is_dir():
            self.skipTest('real DLL/PCK probe is not installed')
        cfg = ModConfig.load('fgo', source=str(locale.parent))
        cfg.paths['localization'] = locale
        categories, diagnostics = parse_assembly(cfg, root, {})
        self.assertEqual({k: len(v) for k, v in categories.items()},
                         {'cards': 171, 'relics': 12, 'potions': 4, 'powers': 69, 'characters': 1})
        self.assertFalse([d for d in diagnostics if d['severity'] == 'error'])
        self.assertFalse([d for d in diagnostics if d['code'] in ('unresolved_variable', 'unresolved_upgrade')])
        cards = {r['id']: r for r in categories['cards']}
        nobles = [card for card in cards.values() if card.get('poolRef') == 'NobleCardPool']
        self.assertEqual(len(nobles), 46)
        self.assertEqual({card['pool'] for card in nobles}, {'noble'})
        self.assertEqual({card['rarity'] for card in nobles}, {'NoblePhantasm'})
        self.assertEqual(cards['Strike']['variables']['Damage'], 6)
        self.assertEqual(cards['Strike']['upgrade']['variables']['Damage'], 9)
        self.assertEqual(cards['SneferuIteruNile']['upgrade']['variables']['DoomPower'], 14)
        self.assertEqual(cards['BeautifulJourney']['variables']['Np'], 0)
        self.assertEqual(cards['AroundCaliburn']['rarity'], 'NoblePhantasm')
        self.assertEqual(cards['FifthForce']['upgrade']['variables']['DamageReduction'], 35)
        self.assertEqual(cards['FifthForce']['upgradeMetadata']['runtimeEffects'][0]['operand'], -15)
        self.assertEqual(cards['AroundCaliburn']['maxUpgradeLevel'], 4)
        self.assertEqual([r['patch']['variables']['AntiPurgeDefensePower'] for r in cards['AroundCaliburn']['upgradeLevels']], [2, 3, 4, 5])
        hero = categories['characters'][0]
        self.assertEqual((hero['startingHp'], hero['startingGold'], len(hero['startingDeck'])), (72, 99, 10))
        self.assertEqual(hero['maxEnergy'], 3)
        self.assertEqual(hero['inheritedFields']['maxEnergy']['source'], 'MegaCrit.Sts2.Core.Models.CharacterModel')


if __name__ == '__main__':
    unittest.main()
