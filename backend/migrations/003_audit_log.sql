USE curriculum;

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_username VARCHAR(100) NOT NULL,
  actor_role VARCHAR(30) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_audit_created_at (created_at),
  INDEX idx_audit_actor (actor_username),
  INDEX idx_audit_entity (entity_type, entity_id)
);
