# Meal Swaps

My dietitian's meal plan lists exact foods and amounts for each day type: rest days, moderate training days and high training days. Meal Swaps shows that plan on my phone and lets me swap an ingredient for something else I eat and stay close on calories, protein, fat and carbs. I built it for myself, my partner uses it too, and it's set up so a dietitian can give it to all their clients.

Each swappable ingredient opens a list of alternatives within 10% of it on calories, protein, fat and carbs. Where 10% of a macro is less than 4 g, the margin is 4 g, and for calories it's 16, so the 0.6 g of fat in a serve of rice can move by up to 4 g. An ingredient with no match stays as planned, and the app shows the small differences that remain.

## How it works

A client signs in once on their phone with a 6-digit code from their email and sees their own plan. Sign-in is by invitation, so only people a dietitian has added can get a code. The plan has one tab per day type, and the client picks the one they're having.

The dietitian keeps writing plans in a spreadsheet or a PDF, and I load each one into the app for the client. The dietitian sees each client's plan as it shows on the client's phone and can flag a swap that looks wrong.

Food values come from the NZ Food Composition Database, from the Australian one where NZ has no entry, or from the label for a named brand. The app works out every swap from those numbers.

## This repo

This repo holds the app as GitHub Pages serves it. The same app runs at two addresses, smamol.github.io/meal-swaps and smamol.github.io/brenda-meal-swaps. The source is private, and each deploy overwrites this repo, so changes made here won't last. Plans, food data and swap groups live in a database behind sign-in.

The app is plain HTML and JavaScript with no build step. Sign-in and data use Supabase. The Supabase JavaScript library ships with the app, and the app keeps the last plan it loaded, so it still works offline.
