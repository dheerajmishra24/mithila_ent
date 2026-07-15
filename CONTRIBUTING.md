# Contributing to Mithila Enterprise

First off, thank you for considering contributing to Mithila Enterprise. It's people like you that make Mithila a great platform for artisan weavers and designers.

## Development Workflow

1. **Clone the repository**
   ```bash
   git clone https://github.com/Arpan-Tyagi/mithila_ent.git
   cd mithila_ent
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   Copy `.env.example` to `.env.local` and add your Supabase credentials.

4. **Run the Development Server**
   ```bash
   npm run dev
   ```

## Pull Request Process

1. Ensure any install or build dependencies are removed before the end of the layer when doing a build.
2. Update the README.md with details of changes to the interface, this includes new environment variables, exposed ports, useful file locations and container parameters.
3. You may merge the Pull Request in once you have the sign-off of at least one other developer, or if you do not have permission to do that, you may request the reviewer to merge it for you.

## Code Style
- Use standard TypeScript (strict mode).
- Use Tailwind for all CSS styling. No raw CSS unless absolutely necessary.
- Prefix React Server Components (RSC) API calls with `requireAuth()` when fetching secure data.
