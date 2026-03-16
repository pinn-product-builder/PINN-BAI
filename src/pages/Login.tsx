import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, ArrowRight, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, user, profile, roles, isPlatformAdmin, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user) return;
    if (!profile || roles.length === 0) return;
    if (isPlatformAdmin) navigate('/admin/hq', { replace: true });
    else if (profile.org_id) navigate(`/client/${profile.org_id}/dashboard`, { replace: true });
  }, [authLoading, user, profile, roles, isPlatformAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast({ title: 'Acesso negado', description: error.message || 'Verifique suas credenciais.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    toast({ title: 'Autenticado', description: 'Carregando seu perfil...', className: 'bg-primary text-primary-foreground border-none' });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex bg-background text-foreground overflow-hidden"
      style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}
    >
      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] p-14 relative overflow-hidden bg-foreground">
        {/* Subtle warm grid */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: 'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />
        {/* Orange glow */}
        <div className="absolute top-1/2 -translate-y-1/2 -left-24 w-[400px] h-[400px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #FF6900 0%, transparent 70%)' }} />

        {/* Logo */}
        <div className="relative z-10">
          <img src="/pinn-logo.svg" alt="Pinn" className="h-8 w-auto brightness-0 invert" />
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/40 bg-primary/15 text-primary text-[11px] font-semibold uppercase tracking-widest">
            <Zap className="w-3 h-3 fill-current" />
            Business AI Intelligence
          </div>
          <h1 className="text-5xl xl:text-[3.5rem] font-bold leading-[1.05] tracking-tight text-white">
            Dados que
            <br />
            <span style={{ color: '#FF6900' }}>geram receita.</span>
          </h1>
          <p className="text-white/50 text-base leading-relaxed max-w-md font-light">
            Dashboards inteligentes que transformam dados brutos em decisões comerciais de alto impacto.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {['IA Preditiva', 'Tempo real', 'Multi-tenant', 'White-label'].map(f => (
              <span key={f} className="px-3 py-1 rounded-lg border border-white/10 bg-white/5 text-white/40 text-xs font-medium">{f}</span>
            ))}
          </div>
        </div>

        {/* Bottom metrics */}
        <div className="relative z-10 flex gap-8">
          {[['98%', 'Uptime'], ['< 2s', 'Load'], ['100%', 'White-label']].map(([val, label]) => (
            <div key={label}>
              <p className="text-xl font-bold" style={{ color: '#FF6900' }}>{val}</p>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 relative bg-background">
        {/* Divider */}
        <div className="absolute top-0 left-0 w-px h-full bg-border hidden lg:block" />

        <div className="relative z-10 w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center">
            <img src="/pinn-logo.svg" alt="Pinn" className="h-8 w-auto" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground"
              style={{ fontFamily: "'Poppins', system-ui, sans-serif" }}>
              Acessar painel
            </h2>
            <p className="text-muted-foreground text-sm">
              Entre com suas credenciais para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Email</Label>
              <Input
                type="email"
                placeholder="voce@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="h-10 bg-card border-border text-foreground placeholder:text-muted-foreground/50 rounded-lg focus-visible:ring-primary/30 focus-visible:border-primary/60"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Senha</Label>
                <button type="button" className="text-xs text-primary/70 hover:text-primary transition-colors">
                  Esqueceu?
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="h-10 bg-card border-border text-foreground placeholder:text-muted-foreground/50 rounded-lg focus-visible:ring-primary/30 focus-visible:border-primary/60 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 mt-2"
              style={{
                background: 'linear-gradient(135deg, #FF6900, #FCB900)',
                color: '#fff',
                fontFamily: "'Poppins', system-ui, sans-serif",
                boxShadow: '0 2px 16px rgba(255,105,0,0.28)'
              }}
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</>
                : <><span>Entrar</span><ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>

          <p className="text-center text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em]">
            Secured by Pinn Protocol · v2
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
