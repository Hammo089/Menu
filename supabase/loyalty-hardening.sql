begin;
-- The API owns authorization. Direct table access remains explicitly forbidden even if
-- a future migration accidentally grants a table privilege to an API role.
create policy loyalty_no_direct_access on blanco_private.loyalty_program for all to anon,authenticated using(false) with check(false);
create policy loyalty_no_direct_access on blanco_private.loyalty_staff for all to anon,authenticated using(false) with check(false);
create policy loyalty_no_direct_access on blanco_private.loyalty_members for all to anon,authenticated using(false) with check(false);
create policy loyalty_no_direct_access on blanco_private.loyalty_rewards for all to anon,authenticated using(false) with check(false);
create policy loyalty_no_direct_access on blanco_private.loyalty_events for all to anon,authenticated using(false) with check(false);
create policy loyalty_no_direct_access on blanco_private.loyalty_registration_limits for all to anon,authenticated using(false) with check(false);
create index loyalty_events_actor on blanco_private.loyalty_events(actor_id);
create index loyalty_events_reward on blanco_private.loyalty_events(reward_id);
create index loyalty_rewards_redeemer on blanco_private.loyalty_rewards(redeemed_by);
commit;
