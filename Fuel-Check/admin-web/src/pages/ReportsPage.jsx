const MOCK_REPORTS = [
  { id: 1, userId: 'USR-0041', shedId: 'SHD-112', queType: 'Petrol', queLength: 24, fuelAvailability: 'Low' },
  { id: 2, userId: 'USR-0078', shedId: 'SHD-089', queType: 'Diesel', queLength: 11, fuelAvailability: 'Available' },
  { id: 3, userId: 'USR-0132', shedId: 'SHD-045', queType: 'Petrol', queLength: 38, fuelAvailability: 'Out of Stock' },
  { id: 4, userId: 'USR-0205', shedId: 'SHD-200', queType: 'Kerosene', queLength: 6, fuelAvailability: 'Available' },
  { id: 5, userId: 'USR-0319', shedId: 'SHD-067', queType: 'Diesel', queLength: 52, fuelAvailability: 'Low' },
];

export default function ReportsPage() {
  return (
    <div className="rp-page">
      <h2 className="rp-title">Total submitted reports</h2>

      <div className="rp-table-wrap">
        <table className="rp-table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Shed ID</th>
              <th>Que Type</th>
              <th>Que Length</th>
              <th>Fuel Availability</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_REPORTS.map((report) => (
              <tr key={report.id}>
                <td>{report.userId}</td>
                <td>{report.shedId}</td>
                <td>{report.queType}</td>
                <td>{report.queLength}</td>
                <td>{report.fuelAvailability}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
