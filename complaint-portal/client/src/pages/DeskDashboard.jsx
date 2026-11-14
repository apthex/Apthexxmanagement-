import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api.js";

export default function DeskDashboard() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ institute_code: "", category: "", status: "", search: "" });
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k,v]) => { if (v) params.set(k, v); });
    api(`/api/complaints?${params.toString()}`).then((d) => setItems(d.items)).catch(()=>{});
  }, [filters]);

  const totals = {
    total: items.length,
    urgent: items.filter(i=>i.urgent).length,
    inprocess: items.filter(i=>i.status==="in_process").length,
    completed: items.filter(i=>i.status==="completed").length,
  };

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Case Desk</h1>
        <div className="flex gap-2">
          <Link to="/desk/stats" className="px-3 py-1 bg-gray-800 rounded">Stats</Link>
          <Link to="/staff/login" className="px-3 py-1 bg-gray-800 rounded" onClick={async()=>{ await api("/api/auth/logout",{method:"POST"}); }}>Logout</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-900 rounded p-4"><div className="text-gray-400 text-sm">Total</div><div className="text-2xl">{totals.total}</div></div>
        <div className="bg-gray-900 rounded p-4"><div className="text-gray-400 text-sm">Urgent</div><div className="text-2xl text-red-400">{totals.urgent}</div></div>
        <div className="bg-gray-900 rounded p-4"><div className="text-gray-400 text-sm">In process</div><div className="text-2xl">{totals.inprocess}</div></div>
        <div className="bg-gray-900 rounded p-4"><div className="text-gray-400 text-sm">Completed</div><div className="text-2xl">{totals.completed}</div></div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input placeholder="Search ref" value={filters.search} onChange={(e)=>setFilters({...filters,search:e.target.value})} className="bg-gray-900 border border-gray-700 rounded px-3 py-2" />
        <input placeholder="Institute code" value={filters.institute_code} onChange={(e)=>setFilters({...filters,institute_code:e.target.value})} className="bg-gray-900 border border-gray-700 rounded px-3 py-2" />
        <select value={filters.status} onChange={(e)=>setFilters({...filters,status:e.target.value})} className="bg-gray-900 border border-gray-700 rounded px-3 py-2">
          <option value="">All status</option>
          <option value="in_process">In process</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-left">
            <tr><th className="py-2">Ref</th><th>Institute</th><th>Category</th><th>Status</th><th>Urgent</th><th>Created</th></tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.ref_id} className="border-t border-gray-800 cursor-pointer hover:bg-gray-900" onClick={() => navigate(`/desk/complaint/${c.ref_id}`)}>
                <td className="py-2 font-mono">{c.ref_id}</td>
                <td>{c.institute_code}</td>
                <td>{c.category}</td>
                <td>{c.status}</td>
                <td>{c.urgent ? "YES" : ""}</td>
                <td>{new Date(c.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
