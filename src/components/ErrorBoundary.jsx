render() {
  const t = this.context || { accent: "#ff0000" };

  if (this.state.hasError) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a1a',
        color: t?.accent || "#ff0000",
        fontFamily: "'Press Start 2P', cursive",
        textAlign: 'center',
        padding: '2rem'
      }}>
        <h1>SYSTEM CRITICAL ERROR</h1>
        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#fff' }}>
          The arena has encountered a fatal anomaly.
        </p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: '2rem',
            padding: '1rem 2rem',
            background: t?.accent || "#ff0000",
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontFamily: "'Press Start 2P', cursive"
          }}
        >
          REBOOT SYSTEM
        </button>
      </div>
    );
  }

  return this.props.children;
}
