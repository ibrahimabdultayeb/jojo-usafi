-- Jojo Usafi — 0022 the announcement strip's own switch
--
-- Build 10 wired the website settings to the storefront, and doing so forced a
-- rule into the open: what does a BLANK field mean?
--
-- It means "use the website's own wording". Not "show nothing". A homepage
-- whose headline disappears because nobody has yet typed one is broken, and an
-- announcement strip that vanishes the moment the settings screen exists is a
-- regression dressed up as a feature. So every text field here is an OVERRIDE
-- of the designed, translated copy, and clearing it restores that copy.
--
-- Which leaves one honest gap: how does an Owner turn the announcement strip
-- OFF? The promotion band already has `promo_banner_visible` for exactly this.
-- The announcement had nothing, and "clear the text" could not mean it without
-- breaking the rule above. Hence one boolean, defaulting to true, because true
-- is what the site does today.
-- =============================================================================

alter table public.shop_settings
  add column if not exists show_announcement boolean not null default true;

comment on column public.shop_settings.show_announcement is
  'Whether the announcement strip appears at all. Blank announcement text means the built-in wording, not silence — this is the off switch.';
