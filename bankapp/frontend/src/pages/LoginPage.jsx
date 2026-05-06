import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Connexion réussie !');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const fill = (e, p) => { setEmail(e); setPassword(p); };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18, margin: '0 auto 14px',
            background: 'linear-gradient(135deg,var(--blue),var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800,
          }}>B</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -.5 }}>
            Bank<span style={{ color: 'var(--blue)' }}>App</span>
          </h1>
          <p style={{ color: 'var(--t2)', fontSize: 13, marginTop: 4 }}>
            Plateforme Bancaire Sécurisée
          </p>
        </div>

        <div className="card card-lg">
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Connexion</h2>
          <p style={{ color: 'var(--t2)', fontSize: 13, marginBottom: 24 }}>
            Entrez vos identifiants pour accéder à votre espace
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label">Email</label>
              <input
                className="input" type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
              />
            </div>
            <div className="form-group">
              <label className="label">Mot de passe</label>
              <input
                className="input" type="password" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        {/* Comptes de test */}
        <div style={{
          marginTop: 16, padding: 14,
          background: 'rgba(59,111,212,.06)',
          border: '1px solid rgba(59,111,212,.2)',
          borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--t2)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--t1)' }}>Comptes de test</div>
          {[
            ['👑 Admin',  'admin@bankapp.tn',   'Admin@123456'],
            ['🏦 Agent',  'agent@bankapp.tn',   'Agent@123456'],
            ['👤 Client', 'client1@bankapp.tn', 'Client@123456'],
          ].map(([role, e, p]) => (
            <div key={e} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>{role}: <strong style={{ color: 'var(--t1)' }}>{e}</strong></span>
              <button
                type="button"
                onClick={() => fill(e, p)}
                style={{
                  background: 'rgba(59,111,212,.15)', border: 'none',
                  color: 'var(--blue2)', fontSize: 11, padding: '2px 8px',
                  borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font)',
                }}
              >
                Remplir
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
