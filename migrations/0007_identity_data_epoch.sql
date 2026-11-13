-- 0006 remains immutable. Catalog reconciliation also tracks identity-bearing data writes.
ALTER TABLE wiki_identity_current ADD COLUMN data_epoch INTEGER NOT NULL DEFAULT -1;
CREATE TABLE wiki_identity_data_epoch (
	id INTEGER PRIMARY KEY CHECK (id=1),
	version INTEGER NOT NULL DEFAULT 0
);
INSERT INTO wiki_identity_data_epoch(id,version) VALUES (1,0);

CREATE TRIGGER wiki_identity_page_insert AFTER INSERT ON wiki_pages BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_page_delete AFTER DELETE ON wiki_pages BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_page_update AFTER UPDATE OF entity_type,entity_id,entity_mod_id,mod_id,identity_status ON wiki_pages
WHEN OLD.entity_type IS NOT NEW.entity_type OR OLD.entity_id IS NOT NEW.entity_id
	OR OLD.entity_mod_id IS NOT NEW.entity_mod_id OR OLD.mod_id IS NOT NEW.mod_id OR OLD.identity_status IS NOT NEW.identity_status BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_comment_insert AFTER INSERT ON comments BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_comment_delete AFTER DELETE ON comments BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_comment_update AFTER UPDATE OF target_type,target_id ON comments
WHEN OLD.target_type IS NOT NEW.target_type OR OLD.target_id IS NOT NEW.target_id BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_mapping_insert AFTER INSERT ON wiki_identity_mappings BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_mapping_update AFTER UPDATE ON wiki_identity_mappings BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_mapping_delete AFTER DELETE ON wiki_identity_mappings BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_archive_insert AFTER INSERT ON wiki_identity_archives BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_archive_delete AFTER DELETE ON wiki_identity_archives BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_comment_archive_insert AFTER INSERT ON wiki_comment_identity_archives BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER wiki_identity_comment_archive_delete AFTER DELETE ON wiki_comment_identity_archives BEGIN
	UPDATE wiki_identity_data_epoch SET version=version+1 WHERE id=1;
END;
