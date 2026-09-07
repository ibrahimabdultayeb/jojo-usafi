# Architecture

Planned application:

Next.js + TypeScript + React + Tailwind.

Deployment:

Vercel.

Backend:

Firebase Authentication
Cloud Firestore
Firebase Storage.

Catalogue control:

Google Sheets.

Architecture:

Google Sheet
    ↕
Synchronization Layer
    ↕
Firestore
    ↕
Storefront / Admin

Public storefront traffic must not depend directly on Google Sheets availability.

Expected domains:

catalogue
brands
suppliers
categories
inventory
customers
orders
promotions
analytics
admin
site content
sync
audit logging

This document must be updated as implementation decisions are finalized.
