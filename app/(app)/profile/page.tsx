import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";


export default async function ProfilePage() {
  const sessionUser = await currentUser();

  if (!sessionUser) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: sessionUser.id,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="page">
      <section className="panel">
        <h2>Account Settings</h2>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginTop: "20px",
          }}
        >
          <Avatar
            url={user.avatarUrl}
            name={`${user.firstName} ${user.surname}`}
            size={64}
          />

          <div>
            <h3>
              {user.firstName} {user.surname}
            </h3>

            <div className="muted">{user.role}</div>
          </div>
        </div>

        <div style={{ marginTop: "20px" }}>
          <p>
            <strong>Email:</strong> {user.email}
          </p>

          <p>
            <strong>Username:</strong> {user.username}
          </p>

          <p>
            <strong>SMTP Enabled:</strong>{" "}
            {user.smtpEnabled ? "Yes" : "No"}
          </p>
        </div>

        <div style={{ marginTop: "20px" }}>
          <button className="primary">
            Edit Profile
          </button>
        </div>


      </section>
    </div>
  );
}