# Database Functions

|Name                |Language|Return Type|Comments|
|--------------------|--------|-----------|--------|
|ack                 |PLPGSQL |void       |Setting ack for a message|
|cron_expire_messages|PLPGSQL |void       |Expire messages, run this function At minute 0 past every 12th hour. (0 */12 * * *)|
|cron_partitioning   |PLPGSQL |void       |Create partitonning, run this function At 00:00. (0 0 * * *)|
|handle_ack          |PLPGSQL |void       |handle messages widthout ack|
|notify              |PLPGSQL |trigger    | process each insert with its respective notify       |
|send                |PLPGSQL |void       |Send message to rabbitmq (async)|
