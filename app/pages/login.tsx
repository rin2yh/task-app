type Props = { error: string | null };

export default function Login({ error }: Props) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h1 style={{ marginTop: 0 }}>Task App にログイン</h1>
        <p style={{ color: 'var(--c-muted)' }}>
          GitHub アカウントでサインインしてください。
        </p>
        {error ? <p style={{ color: '#b91c1c' }}>エラー: {error}</p> : null}
        <a href="/auth/login" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          GitHub でログイン
        </a>
      </div>
    </main>
  );
}
