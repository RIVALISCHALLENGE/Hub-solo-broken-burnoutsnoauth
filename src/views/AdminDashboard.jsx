
function AdminDashboard() {
  // ...existing state and variable declarations...
  const [impersonateUser, setImpersonateUser] = useState(null);
  useEffect(() => { Modal.setAppElement("body"); }, []);

  // ...other hooks and logic...

  return (
    <div>
      {/* Tab content blocks go here, e.g. users, chat, logs, raffle, etc. */}
      {/* ...existing tab content, as in your working code... */}
      {/* User impersonation/preview modal rendered at the root of AdminDashboard */}
      <Modal
        isOpen={!!impersonateUser}
        onRequestClose={() => setImpersonateUser(null)}
        className="fixed inset-0 flex items-center justify-center z-50"
        overlayClassName="fixed inset-0 bg-black/60 z-40"
        ariaHideApp={false}
      >
        {impersonateUser && (
          <div className="bg-zinc-900 p-8 rounded-2xl shadow-2xl border border-zinc-800 w-full max-w-md">
            <h2 className="text-xl font-black text-zinc-100 mb-4">Previewing User</h2>
            <p className="text-zinc-400 mb-2">ID: {impersonateUser.id}</p>
            <p className="text-zinc-400 mb-2">Email: {impersonateUser.email}</p>
            <p className="text-zinc-400 mb-2">Username: {impersonateUser.userName}</p>
            <button onClick={() => setImpersonateUser(null)} className="mt-6 bg-red-600 text-white px-6 py-2 rounded font-black uppercase tracking-widest">Close</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AdminDashboard;
