alter table decks add column commander varchar(255);

UPDATE decks
SET commander = (
  SELECT je.key
  FROM json_each(decks.cards) AS je
  WHERE json_extract(je.value, '$.isCommander') IN (1, 'true', true)
  LIMIT 1
)
WHERE decks.cards IS NOT NULL;