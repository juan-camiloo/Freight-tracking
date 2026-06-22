alter table public.shipments
  drop constraint if exists shipments_trade_direction_check,
  drop column if exists trade_direction,
  drop column if exists commercial_manager,
  drop column if exists operations_manager;
