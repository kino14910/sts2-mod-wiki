
<script lang="ts">
	let {
		checked = $bindable(false),
		disabled = false,
		name,
		value
	}: {
		checked?: boolean
		disabled?: boolean
		name?: string
		value?: string
	} = $props()
</script>

<input
	type="checkbox"
	bind:checked
	{disabled}
	{name}
	{value}
	class="
		m-0
		size-3.25
		appearance-auto
		rounded-none
		border-0
		accent-[#8ccdbe]
	"
/>
