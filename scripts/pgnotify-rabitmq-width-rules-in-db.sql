CREATE SCHEMA IF NOT EXISTS "pgnotify_rabbitmq";

COMMENT ON SCHEMA "pgnotify_rabbitmq" IS 'scheme for control of messages sent to rabbitmq';

CREATE OR REPLACE FUNCTION "pgnotify_rabbitmq"."cron_partitioning"() RETURNS void AS $$
DECLARE
    SQLTEXT TEXT;
    PGVERSION DOUBLE PRECISION;
BEGIN
    SELECT setting INTO  PGVERSION FROM pg_settings WHERE name = 'server_version_num';

    -- Partitioning Supported Versions
    IF (PGVERSION >= 100000) THEN
        SQLTEXT := CONCAT (
            'CREATE TABLE IF NOT EXISTS "pgnotify_rabbitmq"."messages_',
            REPLACE((timezone('UTC', NOW())::DATE )::TEXT, '-', '_'),
            '" PARTITION OF "pgnotify_rabbitmq"."messages" ',
            'FOR VALUES FROM (''',
            (timezone('UTC', NOW())::DATE )::TEXT,
            ' 00:00:00''::TIMESTAMP WITHOUT TIME ZONE) TO (''',
            ((timezone('UTC', NOW())::DATE ) + 1)::TEXT,
            ' 00:00:00''::TIMESTAMP WITHOUT TIME ZONE);'
        );

        SQLTEXT := CONCAT (
            SQLTEXT,
            ' DROP TABLE IF EXISTS "pgnotify_rabbitmq"."messages_',
            REPLACE(((timezone('UTC', NOW())::DATE ) - 5)::TEXT, '-', '_'),
            '";'
        );
        
        RAISE NOTICE '%', SQLTEXT;
        EXECUTE(SQLTEXT);        
    END IF;
END;
$$ VOLATILE LANGUAGE PLPGSQL;
COMMENT ON FUNCTION "pgnotify_rabbitmq"."cron_partitioning"() IS 'Create partitonning, run this function At 00:00. (0 0 * * *)';

DO $$
DECLARE
    PGVERSION DOUBLE PRECISION;
	SQLTEXT TEXT;
BEGIN
    SELECT setting INTO  PGVERSION FROM pg_settings WHERE name = 'server_version_num';

    -- Partitioning Supported Versions
    IF (PGVERSION >= 100000) THEN
        SQLTEXT := CONCAT(
			'CREATE TABLE IF NOT EXISTS "pgnotify_rabbitmq"."messages" (',
            'id SERIAL NOT NULL ,',
            'ts TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE ''UTC''),',
            'ts_ack TIMESTAMP WITHOUT TIME ZONE,',
            'ts_exp TIMESTAMP WITHOUT TIME ZONE,',
            'ttl interval DEFAULT ''24 hours'',',
            'ack BOOLEAN NOT NULL DEFAULT FALSE,'
            'topic VARCHAR(255) NOT NULL,',
            'payload TEXT NOT NULL,',
            'CONSTRAINT notify_rabbitmq_messages_pkey  PRIMARY KEY (id,ts)',
            ') PARTITION BY RANGE (ts);'
        );
		-- to support both postgres 9.4 or 10+
        EXECUTE (SQLTEXT);

        -- Current date partitioning        
        PERFORM "pgnotify_rabbitmq"."cron_partitioning"();
    ELSE
        CREATE TABLE IF NOT EXISTS "pgnotify_rabbitmq"."messages" (
            id SERIAL PRIMARY KEY NOT NULL ,
            ts TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'UTC'),
            ts_ack TIMESTAMP WITHOUT TIME ZONE,
            ts_exp TIMESTAMP WITHOUT TIME ZONE,
            ttl interval DEFAULT '24 hours',
            ack BOOLEAN NOT NULL DEFAULT FALSE,
            topic VARCHAR(255) NOT NULL,    
            payload TEXT NOT NULL
        );
    END IF;
END$$;

CREATE INDEX ON "pgnotify_rabbitmq"."messages" (ts);

COMMENT ON TABLE "pgnotify_rabbitmq"."messages" IS 'Contains the messages to be sent to rabbitmq';
COMMENT ON COLUMN "pgnotify_rabbitmq"."messages"."id" IS 'messages ID number';
COMMENT ON COLUMN "pgnotify_rabbitmq"."messages"."ts" IS 'messages utc timestamp creation';
COMMENT ON COLUMN "pgnotify_rabbitmq"."messages"."ts_ack" IS 'messages utc timestamp acknowledgement';
COMMENT ON COLUMN "pgnotify_rabbitmq"."messages"."ts_exp" IS 'messages utc timestamp expiration';
COMMENT ON COLUMN "pgnotify_rabbitmq"."messages"."ttl" IS 'messages time to live';
COMMENT ON COLUMN "pgnotify_rabbitmq"."messages"."ack" IS 'messages acknowledgement confirmation (default false, true is confirmed)';
COMMENT ON COLUMN "pgnotify_rabbitmq"."messages"."topic" IS 'pg_notify channel';
COMMENT ON COLUMN "pgnotify_rabbitmq"."messages"."payload" IS 'pg_notify payload';

CREATE OR REPLACE FUNCTION "pgnotify_rabbitmq"."notify"() RETURNS TRIGGER AS $$
DECLARE
    matched BOOLEAN;
    QUOTE RECORD;
    RULE RECORD;
BEGIN
    -- Validate rules
    -- only one rule will have effect order by type (denied, redirect) and weight (default 1)
    SELECT * INTO RULE  FROM  "pgnotify_rabbitmq"."rules" r WHERE 
    	r.active AND 
	    r.topic = NEW.topic AND
	    (r.reg_exp IS NULL OR NEW.payload  ~* r.reg_exp)
    ORDER BY rule_type, weight LIMIT 1;

    IF ( RULE.rule_type = 'denied' ) THEN
        RAISE NOTICE 'Denied message rule (ID:%) %', RULE.id,  NEW.topic;
        RETURN NULL;
    ELSIF ( RULE.rule_type = 'redirect' ) THEN
        RAISE NOTICE 'Redirect message rule (ID:%) % to %', RULE.id, NEW.topic, RULE.args->>'to';
        NEW.topic := RULE.args->>'to';
    END IF;

    -- validate quotes
    FOR QUOTE IN EXECUTE 
        'SELECT * FROM "pgnotify_rabbitmq"."quotes" q WHERE q.active AND q.topic = ''' || NEW.topic || ''''
    LOOP
        matched := QUOTE.reg_exp IS NULL OR NEW.payload ~* QUOTE.reg_exp;

        IF ( matched ) THEN

            RAISE NOTICE 'Validate quote message (ID:%) to %', QUOTE.id, NEW.topic;

            QUOTE.cnt_msg := QUOTE.cnt_msg + 1;
            
            IF (QUOTE.ttl IS NOT NULL AND 
                (NOW() AT TIME ZONE 'UTC') - QUOTE.ts_cnt >= QUOTE.ttl) THEN
                RAISE NOTICE 'Reset quote message (ID:%) to %', QUOTE.id, NEW.topic;
                UPDATE "pgnotify_rabbitmq"."quotes"
                    SET cnt_msg = 0,  ts_cnt=(NOW() AT TIME ZONE 'UTC')
                    WHERE id = QUOTE.id;
            ELSE
                RAISE NOTICE 'Increment quote message (ID:%) to %', QUOTE.id, NEW.topic;
                UPDATE "pgnotify_rabbitmq"."quotes"  
                    SET cnt_msg = QUOTE.cnt_msg WHERE id = QUOTE.id;
            END IF;

            IF (QUOTE.cnt_msg > QUOTE.max_msg) THEN
                RAISE NOTICE 'Denied message quote (ID:%) % > %', QUOTE.id,  QUOTE.cnt_msg , QUOTE.max_msg;
                RETURN NULL;
            END IF;
        END IF;
    END LOOP;

    PERFORM pg_notify(NEW.topic, CONCAT('ID:', NEW.id, '|', NEW.payload));
    RETURN NEW;
END;
$$ VOLATILE LANGUAGE PLPGSQL;

DROP TRIGGER IF EXISTS "tg_notify_rabbitmq_messages" ON "pgnotify_rabbitmq"."messages";
CREATE TRIGGER "tg_notify_rabbitmq_messages" BEFORE INSERT ON "pgnotify_rabbitmq"."messages"
    FOR EACH ROW EXECUTE PROCEDURE "pgnotify_rabbitmq"."notify"();

CREATE OR REPLACE FUNCTION "pgnotify_rabbitmq"."send"(topic text, payload text) RETURNS void AS $$
BEGIN
    BEGIN	
    	INSERT INTO pgnotify_rabbitmq.messages (topic, payload) VALUES (topic, payload);
	EXCEPTION WHEN check_violation THEN
	    PERFORM pgnotify_rabbitmq.cron_partitioning();
		INSERT INTO pgnotify_rabbitmq.messages (topic, payload) VALUES (topic, payload);
  	END;
END;
$$ VOLATILE LANGUAGE PLPGSQL;
COMMENT ON FUNCTION "pgnotify_rabbitmq"."send"( TEXT, TEXT) IS 'Send message to rabbitmq (async)';

CREATE OR REPLACE FUNCTION "pgnotify_rabbitmq"."ack"(msg_id INT) RETURNS void AS $$
BEGIN
    UPDATE pgnotify_rabbitmq.messages SET ack=TRUE, ts_ack=(NOW() AT TIME ZONE 'UTC') WHERE id=msg_id;
END;
$$ VOLATILE LANGUAGE PLPGSQL;
COMMENT ON FUNCTION "pgnotify_rabbitmq"."ack"(INT) IS 'Setting ack for a message';

CREATE OR REPLACE FUNCTION "pgnotify_rabbitmq"."cron_expire_messages"() RETURNS void AS $$
BEGIN
    UPDATE pgnotify_rabbitmq.messages SET ts_exp=(NOW() AT TIME ZONE 'UTC') 
    WHERE 
        ts + ttl <= (NOW() AT TIME ZONE 'UTC') AND ack = false;
END;
$$ VOLATILE LANGUAGE PLPGSQL;
COMMENT ON FUNCTION "pgnotify_rabbitmq"."cron_expire_messages"() IS 'Expire messages, run this function At minute 0 past every 12th hour. (0 */12 * * *)';

CREATE OR REPLACE FUNCTION "pgnotify_rabbitmq"."handle_ack"() RETURNS void AS $$
BEGIN
    PERFORM pg_notify(topic, CONCAT('ID:',id, '|',payload)) FROM "pgnotify_rabbitmq"."messages" 
    WHERE ack = false AND ts_exp IS NULL 
    ORDER BY ts ASC LIMIT 100;
END;
$$ VOLATILE LANGUAGE PLPGSQL;
COMMENT ON FUNCTION "pgnotify_rabbitmq"."handle_ack"() IS 'handle messages widthout ack';

-- Create cron task to expire messages
DO $$
DECLARE
    JOB_EXISTS INTEGER;
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    SELECT COUNT(*) INTO JOB_EXISTS FROM cron.job WHERE jobname = 'pgnotify_rabbitmq_cron_expire_messages';
    IF (JOB_EXISTS > 0) THEN
        PERFORM cron.unschedule('pgnotify_rabbitmq_cron_expire_messages');
    END IF;

    SELECT COUNT(*) INTO JOB_EXISTS FROM cron.job WHERE jobname = 'pgnotify_rabbitmq_cron_partitioning';
    IF (JOB_EXISTS > 0) THEN
        PERFORM cron.unschedule('pgnotify_rabbitmq_cron_partitioning');
    END IF;

    SELECT COUNT(*) INTO JOB_EXISTS FROM cron.job WHERE jobname = 'pgnotify_rabbitmq_cron_pgnotify_rabbitmq';
    IF (JOB_EXISTS > 0) THEN
        PERFORM cron.unschedule('pgnotify_rabbitmq_cron_pgnotify_rabbitmq');
    END IF;    

    PERFORM cron.schedule('pgnotify_rabbitmq_cron_expire_messages', '0 */12 * * *', 'SELECT pgnotify_rabbitmq.cron_expire_messages();');
    PERFORM cron.schedule('pgnotify_rabbitmq_cron_partitioning', '0 0 * * *', 'SELECT pgnotify_rabbitmq.cron_partitioning();');
    PERFORM cron.schedule('pgnotify_rabbitmq_cron_pgnotify_rabbitmq.handle_ack', '* * * * *', 'SELECT pgnotify_rabbitmq.handle_ack();');    

    EXCEPTION 
    WHEN INVALID_SCHEMA_NAME THEN 
        RAISE NOTICE 'could not create cron task';
        WHEN UNDEFINED_FILE THEN 
        RAISE NOTICE 'could not create cron task';          
END$$;

-- Version 2 add tables for rules and quotes

CREATE TABLE IF NOT EXISTS "pgnotify_rabbitmq"."rules" (
    id SERIAL NOT NULL ,
    ts TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'UTC'),
    topic VARCHAR(255) NOT NULL,
    rule_type VARCHAR(255) NOT NULL CHECK (rule_type = ANY (ARRAY['denied', 'redirect'])),
    weight INTEGER DEFAULT 1,
    reg_exp TEXT,
    args JSON,
    active BOOLEAN DEFAULT TRUE,
    CONSTRAINT notify_rabbitmq_rules_pkey  PRIMARY KEY (id)
);

COMMENT ON TABLE "pgnotify_rabbitmq"."rules" IS 'Contains rules to redirect, allow o denied messages.';
COMMENT ON COLUMN "pgnotify_rabbitmq"."rules"."id" IS 'Rules unique id';
COMMENT ON COLUMN "pgnotify_rabbitmq"."rules"."ts" IS 'Created timestamp';
COMMENT ON COLUMN "pgnotify_rabbitmq"."rules"."topic" IS 'Notify channel to apply rules';
COMMENT ON COLUMN "pgnotify_rabbitmq"."rules"."rule_type" IS 'The types of rules. redirect, allow or deny are acceptable values';
COMMENT ON COLUMN "pgnotify_rabbitmq"."rules"."reg_exp" IS 'Regular expression for apply to the messages payload field';
COMMENT ON COLUMN "pgnotify_rabbitmq"."rules"."args" IS 'JSON field for additional values used according to the rule_type field. For example, redirect rule_type can set the ffiel "to" in the JSON arguments';

CREATE TABLE IF NOT EXISTS "pgnotify_rabbitmq"."quotes" (
    id SERIAL NOT NULL ,
    ts TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'UTC'),
    ts_cnt TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'UTC'),
    ttl INTERVAL,    
    topic VARCHAR(255) NOT NULL,
    reg_exp TEXT,
    max_msg DOUBLE PRECISION NOT NULL CHECK(max_msg > 0),
    cnt_msg DOUBLE PRECISION DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    CONSTRAINT notify_rabbitmq_quotes_pkey  PRIMARY KEY (id)
);

COMMENT ON TABLE "pgnotify_rabbitmq"."quotes" IS 'Contains quotes for messajes table';
COMMENT ON COLUMN "pgnotify_rabbitmq"."quotes"."id" IS 'Quotes unique id';
COMMENT ON COLUMN "pgnotify_rabbitmq"."quotes"."ts" IS 'Created timestamp';
COMMENT ON COLUMN "pgnotify_rabbitmq"."quotes"."topic" IS 'Notify channel to apply quotes';
COMMENT ON COLUMN "pgnotify_rabbitmq"."quotes"."reg_exp" IS 'Regular expression for apply to the messages payload field';
COMMENT ON COLUMN "pgnotify_rabbitmq"."quotes"."max_msg" IS 'Maximum number of messages for a given notify channel(topic)';
COMMENT ON COLUMN "pgnotify_rabbitmq"."quotes"."cnt_msg" IS 'Counter of messages for a given notify channel(topic)';
COMMENT ON COLUMN "pgnotify_rabbitmq"."quotes"."ttl" IS 'Amount of time to keep the counter, after this time interval the counter is reset';
