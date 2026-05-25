-- V19: Remoção física das tabelas e colunas relacionadas a eventos de cobrança e renegociação de promissórias

DROP TABLE IF EXISTS promissory_note_collection_events;

ALTER TABLE promissory_notes 
    DROP COLUMN IF EXISTS renegotiated_at, 
    DROP COLUMN IF EXISTS renegotiated_by_user_id, 
    DROP COLUMN IF EXISTS renegotiation_reason;
