# Wayfinder AgriX Drone

Wayfinder AgriX Drone - 農家と業者をつなぐドローン農作業予約プラットフォーム（[Wayfinder WorX](https://wayfinderworx.com/)）

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Supabase（ログインで「permission denied for table users」が出る場合）

**Supabase Dashboard → SQL Editor** で、次の SQL を **そのまままとめて** 実行してください。

```sql
-- 1. authenticated ロールに権限付与（必須）
grant select, insert, update on public.users to authenticated;

-- 2. RLS とポリシー（既に実行済みの場合は「policy already exists」でスキップしてよい）
alter table public.users enable row level security;

drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_insert_own" on public.users;
drop policy if exists "users_update_own" on public.users;

create policy "users_select_own" on public.users for select to authenticated using ( (auth.jwt() ->> 'email') = email );
create policy "users_insert_own" on public.users for insert to authenticated with check ( (auth.jwt() ->> 'email') = email );
create policy "users_update_own" on public.users for update to authenticated using ( (auth.jwt() ->> 'email') = email ) with check ( (auth.jwt() ->> 'email') = email );
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
