import { useEffect, useState } from "react";
import { useAppContext } from "../state/AppContext";

export default function TopBarV2() {
  const { currentUser, logout, updateUserProfile } = useAppContext();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    department: "",
    organization: "",
    about: "",
  });

  useEffect(() => {
    if (!currentUser) return;

    setProfileForm({
      name: currentUser.name ?? "",
      phone: currentUser.phone ?? "",
      department: currentUser.department ?? "",
      organization: currentUser.organization ?? "",
      about: currentUser.about ?? "",
    });
  }, [currentUser]);

  if (!currentUser) return null;

  const saveProfile = () => {
    updateUserProfile(currentUser.id, profileForm);
    setSettingsOpen(false);
  };

  return (
    <div className="topbar-stack">
      <div className="portal-switcher">
        <div className="topbar-left">
          <button className="button secondary" onClick={() => setSettingsOpen((current) => !current)}>
            Account & Settings
          </button>
          <div>
            <p className="eyebrow">Signed In</p>
            <h2>{currentUser.name}</h2>
            <p className="muted">
              {currentUser.role} • {currentUser.email}
            </p>
          </div>
        </div>
        {currentUser.role !== "student" ? (
          <button className="button secondary" onClick={() => logout(`${currentUser.role} logged out.`)}>
            Log Out
          </button>
        ) : (
          <span className="badge active">student session</span>
        )}
      </div>

      {settingsOpen ? (
        <section className="panel settings-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Account</p>
              <h3>Profile and settings</h3>
            </div>
            <button className="button" onClick={() => setSettingsOpen(false)}>
              Close
            </button>
          </div>
          <div className="form-grid profile-grid">
            <input
              className="input"
              placeholder="Full name"
              value={profileForm.name}
              onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
            />
            <input
              className="input"
              placeholder="Phone number"
              value={profileForm.phone}
              onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
            />
            <input
              className="input"
              placeholder="Department"
              value={profileForm.department}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, department: event.target.value }))
              }
            />
            <input
              className="input"
              placeholder="Organization"
              value={profileForm.organization}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, organization: event.target.value }))
              }
            />
            <textarea
              className="input textarea short-textarea"
              placeholder="Personal details or notes"
              value={profileForm.about}
              onChange={(event) => setProfileForm((current) => ({ ...current, about: event.target.value }))}
            />
          </div>
          <div className="actions-row">
            <button className="button primary" onClick={saveProfile}>
              Save Profile
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
