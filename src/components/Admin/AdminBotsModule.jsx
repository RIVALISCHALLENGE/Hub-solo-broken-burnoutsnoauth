// AdminBotsModule.jsx
// React component for managing bots in the admin console
import React, { useEffect, useState } from 'react';

// Import the API functions (assume relative path to project root)
import {
  listBots,
  updateBotStats,
  forceBotJoin,
  forceBotLeave,
  updateBotConfig,
} from '../../../hub-admin-bots';

const AdminBotsModule = () => {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchBots() {
      setLoading(true);
      try {
        const data = await listBots();
        setBots(data);
        setError(null);
      } catch (err) {
        setError('Failed to load bots');
      }
      setLoading(false);
    }
    fetchBots();
  }, []);

  const handleForceJoin = async (botId) => {
    await forceBotJoin(botId);
    // Optionally refresh list
  };

  const handleForceLeave = async (botId) => {
    await forceBotLeave(botId);
    // Optionally refresh list
  };

  // ...add more handlers as needed

  if (loading) return <div>Loading bots...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h2>Bot Management</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {bots.map((bot) => (
            <tr key={bot.id}>
              <td>{bot.id}</td>
              <td>{bot.name}</td>
              <td>
                <button onClick={() => handleForceJoin(bot.id)}>Force Join</button>
                <button onClick={() => handleForceLeave(bot.id)}>Force Leave</button>
                {/* Add more actions as needed */}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminBotsModule;
