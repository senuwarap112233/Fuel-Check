import { useState } from 'react';

const INITIAL_PENDING = [
  { id: 'p1', name: 'S.P.Lanka petroleum (pvt) ltd, Agalawatta' },
  { id: 'p2', name: 'S.P.Lanka petroleum (pvt) ltd, Agalawatta' },
  { id: 'p3', name: 'S.P.Lanka petroleum (pvt) ltd, Agalawatta' },
];

const INITIAL_REGISTERED = [
  { regNo: 'FS-001', name: 'S.P.Lanka Petroleum', area: 'Agalawatta', status: 'Active', fuelsStocks: 'Petrol, Diesel', actions: '' },
  { regNo: 'FS-002', name: 'Caltex Horana', area: 'Horana', status: 'Active', fuelsStocks: 'Petrol', actions: '' },
  { regNo: 'FS-003', name: 'Lanka IOC Panadura', area: 'Panadura', status: 'Inactive', fuelsStocks: 'Petrol, Diesel, Kerosene', actions: '' },
];

export default function FuelStationsPage() {
  const [pending, setPending] = useState(INITIAL_PENDING);
  const [registered] = useState(INITIAL_REGISTERED);

  const handleApprove = (id) => {
    setPending((prev) => prev.filter((s) => s.id !== id));
  };

  const handleReject = (id) => {
    setPending((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="fs-page">
      <h2 className="fs-page-title">Manage all Fuel Stations</h2>

      {/* Pending approvals card */}
      <div className="pending-card">
        <p className="pending-card-title">Approve Pending Registrations</p>

        {pending.length === 0 ? (
          <p className="pending-empty">No pending registrations.</p>
        ) : (
          pending.map((station) => (
            <div key={station.id} className="pending-row">
              <span className="pending-name">{station.name}</span>
              <div className="pending-actions">
                <button className="btn-preview">Preview</button>
                <button className="btn-approve" onClick={() => handleApprove(station.id)}>Approve</button>
                <button className="btn-reject" onClick={() => handleReject(station.id)}>Reject</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Registered stations table */}
      <div className="fs-table-wrap">
        <table className="fs-table">
          <thead>
            <tr>
              <th>Reg-No</th>
              <th>Name</th>
              <th>Area</th>
              <th>Status</th>
              <th>Fuels Stocks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {registered.map((row) => (
              <tr key={row.regNo}>
                <td>{row.regNo}</td>
                <td>{row.name}</td>
                <td>{row.area}</td>
                <td>
                  <span className={`status-badge ${row.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                    {row.status}
                  </span>
                </td>
                <td>{row.fuelsStocks}</td>
                <td>
                  <button className="btn-preview sm">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
