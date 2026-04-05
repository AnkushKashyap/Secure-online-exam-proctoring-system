import { useAppContext } from "../state/AppContext";

export default function PortalSwitcher() {
  const { users, currentUser, setCurrentUser } = useAppContext();

  return (
    <div className="portal-switcher">
      <div>
        <p className="eyebrow">Portal Access</p>
        <h2>{currentUser.role[0].toUpperCase() + currentUser.role.slice(1)} Workspace</h2>
      </div>
      <select
        className="select"
        value={currentUser.id}
        onChange={(event) => setCurrentUser(event.target.value)}
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} - {user.role}
          </option>
        ))}
      </select>
    </div>
  );
}
