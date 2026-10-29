CREATE OR REPLACE FUNCTION notify_record_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify('opstracker_record_changes', 'records-changed');

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER assistance_record_change
AFTER INSERT OR UPDATE OR DELETE ON assistance
FOR EACH ROW EXECUTE FUNCTION notify_record_change();

CREATE TRIGGER tasks_record_change
AFTER INSERT OR UPDATE OR DELETE ON tasks
FOR EACH ROW EXECUTE FUNCTION notify_record_change();

CREATE TRIGGER work_logs_record_change
AFTER INSERT OR UPDATE OR DELETE ON work_logs
FOR EACH ROW EXECUTE FUNCTION notify_record_change();