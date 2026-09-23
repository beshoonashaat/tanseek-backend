CREATE TABLE IF NOT EXISTS lab_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id bigint NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  checked_by bigint NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  status varchar(30) NOT NULL CHECK (status IN ('PASS','FAIL','PENDING')),
  notes text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lab_checks_room_time_idx ON lab_checks(room_id, checked_at DESC);
