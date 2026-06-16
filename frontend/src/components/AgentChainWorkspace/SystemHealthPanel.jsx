import React, { useState, useEffect } from 'react';
import { AlertTriangle, ServerCrash, Clock, ShieldAlert, CheckCircle, Database } from 'lucide-react';
import api from '../../api';

const SystemHealthPanel = ({ topicId }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Fetch all events for this user's topics
        const res = await api.get('/api/system-events/');
        // If we want to filter by topic, we could pass it or filter client side.
        // Assuming the backend returns all for user, we can filter for current topic:
        const topicEvents = res.data.filter(e => String(e.topic) === String(topicId));
        setEvents(topicEvents);
      } catch (err) {
        console.error("Failed to load system events", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [topicId]);

  const getIconForType = (type) => {
    switch (type) {
      case 'rate_limit': return <Clock className="text-amber-500" size={20} />;
      case 'schema_error': return <Database className="text-red-500" size={20} />;
      case 'provider_error': return <ServerCrash className="text-red-500" size={20} />;
      case 'evaluation_failed': return <AlertTriangle className="text-orange-500" size={20} />;
      default: return <ShieldAlert className="text-gray-500" size={20} />;
    }
  };

  const formatType = (type) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 p-6 overflow-y-auto">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">System Health</h1>
            <p className="text-sm text-gray-500 mt-1">Platform execution errors, configuration issues, and rate limits.</p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
            <h3 className="mt-4 text-sm font-medium text-gray-900">All Systems Operational</h3>
            <p className="mt-1 text-sm text-gray-500">No execution errors or rate limits have been detected in this workspace.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Event Type</th>
                  <th className="px-6 py-4 font-medium">Agent</th>
                  <th className="px-6 py-4 font-medium">Error Details</th>
                  <th className="px-6 py-4 font-medium">Suggested Platform Fix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {new Date(event.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getIconForType(event.event_type)}
                        <span className="font-medium text-gray-900">{formatType(event.event_type)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {event.agent_name || 'System'}
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <div className="text-red-600 font-mono text-xs break-words">
                        {event.message}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-700 bg-gray-50 p-2 rounded text-xs border border-gray-200">
                        {event.suggested_fix || 'Check system logs for details.'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemHealthPanel;
