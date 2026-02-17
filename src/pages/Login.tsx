import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
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

  // Single redirect effect — fires when auth state settles
  useEffect(() => {
    if (authLoading || !user) return;
    // Wait until profile & roles are loaded
    if (!profile || roles.length === 0) return;

    if (isPlatformAdmin) {
      navigate('/admin/hq', { replace: true });
    } else if (profile.org_id) {
      navigate(`/client/${profile.org_id}/dashboard`, { replace: true });
    }
  }, [authLoading, user, profile, roles, isPlatformAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: 'Acesso Negado',
        description: error.message || 'Verifique suas credenciais.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Autenticado',
      description: 'Carregando seu perfil...',
      className: 'bg-primary text-primary-foreground border-none',
    });

    // The onAuthStateChange listener in AuthContext will update user/profile/roles,
    // which triggers the useEffect above to redirect.
    // Keep loading state — redirect will unmount this component.
  };

  // Show loading if auth is still initializing
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] relative overflow-hidden text-white font-sans selection:bg-primary/30">

      {/* Ambient Glow Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-accent/10 rounded-full blur-[100px]" />

      <div className="w-full max-w-md z-10 p-6">
        <div className="text-center mb-10 space-y-4">
          <div className="flex justify-center mb-6">
            <img src="/pinn-logo.svg" alt="Pinn Logo" className="h-12 w-auto" />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/70">
            Construa. <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Automatize.
            </span>
          </h1>
          <p className="text-white/40 text-sm md:text-base font-light max-w-xs mx-auto leading-relaxed">
            O futuro da sua empresa começa aqui. Acesse seu painel de inteligência.
          </p>
        </div>

        <Card className="border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-primary/5 rounded-2xl overflow-hidden">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase tracking-widest text-white/50 font-semibold ml-1">Email Corporativo</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 bg-black/40 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs uppercase tracking-widest text-white/50 font-semibold ml-1">Senha de Acesso</Label>
                  <button type="button" className="text-xs text-primary hover:text-primary/80 transition-colors">
                    Recuperar acesso
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 bg-black/40 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20 rounded-xl pr-10 transition-all"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-black font-bold text-lg rounded-xl shadow-lg shadow-primary/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Conectando...</span>
                  </div>
                ) : (
                  'Acessar Painel'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center space-y-4">
          <div className="flex justify-center gap-4">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-white/20" />
          </div>
          <p className="text-[10px] text-white/20 uppercase tracking-[0.2em]">
            Secured by Pinn Protocol
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
