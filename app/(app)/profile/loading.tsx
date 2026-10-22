export default function ProfileLoading() {
  return (
    <div className="page" aria-label="Loading account settings" aria-busy="true">
      <div className="profile-skeleton">
        <div className="profile-skeleton-block profile-skeleton-overview" />
        <div className="profile-skeleton-grid">
          <div className="profile-skeleton-block profile-skeleton-card" />
          <div className="profile-skeleton-side">
            <div className="profile-skeleton-block profile-skeleton-card" />
            <div className="profile-skeleton-block profile-skeleton-card" />
          </div>
        </div>
      </div>
    </div>
  );
}