"use client";

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }
      // Verify admin role
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
      if (profile?.role === 'admin') {
        window.location.href = '/admin/dashboard';
      } else {
        await supabase.auth.signOut();
        setMessage('Access Denied. You do not have admin privileges.');
      }
    } catch (err) {
      setMessage('Network error or invalid credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--charcoal-ink)] flex items-center justify-center py-16 px-4">
      <div className="max-w-md w-full bg-[var(--unbleached-cotton)] p-8 shadow-[8px_8px_0_var(--turmeric)]">
        <h1 className="font-serif text-2xl font-bold mb-2 text-[var(--charcoal-ink)]">Owner Portal</h1>
        <p className="font-sans text-sm opacity-70 mb-6">Restricted Access.</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin Email" 
            required 
            className="w-full border-2 border-[var(--charcoal-ink)] p-3 font-sans focus:outline-none bg-transparent"
          />
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password" 
            required 
            className="w-full border-2 border-[var(--charcoal-ink)] p-3 font-sans focus:outline-none bg-transparent"
          />
          <Button type="submit" className="w-full bg-[var(--charcoal-ink)] text-white hover:bg-[var(--madder-red)]">Authenticate</Button>
        </form>
        {message && <p className="mt-4 text-sm font-sans font-bold text-[var(--madder-red)]">{message}</p>}
      </div>
    </div>
  );
}
