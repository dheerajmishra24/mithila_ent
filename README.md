# Mithila Enterprise

Mithila Enterprise is a premium B2B and Direct-to-Consumer e-commerce platform built for artisan weavers and designers. It includes a full public-facing storefront, a comprehensive executive ledger (admin dashboard), and a robust backend.

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Database / Auth**: Supabase
- **Payments**: Razorpay
- **Emails**: Resend

## Documentation

All architectural, deployment, and testing documentation has been organized into the `docs/` folder:

- **[Architecture](docs/architecture.md)**: Core structural decisions, database schema, and styling system.
- **[Design System](docs/design_system.md)**: UI tokens, typography, and component guidelines.
- **[Deployment Guide](docs/deployment.md)**: How to deploy this application to Vercel and Supabase.
- **[Pre-Deploy Checklist](docs/pre_deploy_checklist.md)**: Final quality assurance checks before going live.
- **[Test Plan](docs/test_plan.md)**: E2E testing strategy with Playwright.

## Getting Started

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Set up Environment Variables**
   Copy `.env.example` to `.env.local` and add your keys (Supabase, Razorpay, Resend, Meta).

3. **Database Setup**
   Run the SQL migrations located in `supabase/migrations/` inside your Supabase SQL Editor.

4. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the application.

## Contributing
Please see `CONTRIBUTING.md` for guidelines on pull requests and coding standards.

## License
This project is licensed under the MIT License - see the `LICENSE` file for details.
