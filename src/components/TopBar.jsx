import { useAppContext } from "../state/AppContext";

export default function TopBar() {
  const { currentUser, logout } = useAppContext();

  if (!currentUser) return null;

  return (
    <div className="portal-switcher">
      <div>
        <p className="eyebrow">Signed In</p>
        <h2>{currentUser.name}</h2>
        <p className="muted">
          {currentUser.role} • {currentUser.email}
        </p>
      </div>
      {currentUser.role !== "student" ? (
        <button className="button secondary" onClick={() => logout(`${currentUser.role} logged out.`)}>
          Log Out
        </button>
      ) : (
        <span className="badge active">student session</span>
      )}
    </div>
  );
}
