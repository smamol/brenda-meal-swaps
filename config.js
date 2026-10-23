/*
 * config.js — the Supabase project the page talks to (step 3, 2026-10-23).
 * Both values are public by design: the anon key only reaches what the
 * row-level security policies allow. Secret keys never go here; they live in
 * ~/.config/mealswaps/ on Sandy's Mac.
 */
const CONFIG = {
  url: 'https://ildywbnbtxixvdlgvhhm.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsZHl3Ym5idHhpeHZkbGd2aGhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MDQ5MDQsImV4cCI6MjEwODI4MDkwNH0.Y1FxdJTLnF7p7yZAvjjLFlmsHQrPaJnDbhow-tC9osA',
};

if (typeof module !== 'undefined' && module.exports) module.exports = { CONFIG };
