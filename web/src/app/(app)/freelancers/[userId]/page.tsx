"use client";

// Public freelancer profile — any authed role (Architecture.md §4).
// Read-only view of profile, skills, portfolio, and reviews.

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/app/providers";
import { freelancerProfileOptions } from "@/features/profiles/queries";
import { userReviewsOptions, userAverageRatingOptions } from "@/features/reviews/queries";

export default function FreelancerProfilePage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const { user } = useSession();

  const userId = Number(params.userId);

  // AppLayout ensures user is non-null before rendering
  if (!user) return null;

  if (isNaN(userId)) {
    router.replace("/dashboard");
    return null;
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full">
        <FreelancerProfile userId={userId} />
      </main>
    </div>
  );
}

function FreelancerProfile({ userId }: { userId: number }) {
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery(
    freelancerProfileOptions(userId),
  );
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery(
    userReviewsOptions(userId),
  );
  const { data: ratingData } = useQuery(userAverageRatingOptions(userId));

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-muted-foreground">Freelancer profile not found.</p>
      </div>
    );
  }

  const avgRating = ratingData?.average_rating;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {profile.professional_title || "Freelancer"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Hourly rate: <span className="font-medium text-foreground">${profile.hourly_rate}/hr</span>
            </p>
          </div>
          <div className="text-right">
            {avgRating !== null && avgRating !== undefined ? (
              <div className="flex items-center gap-1">
                <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm font-medium text-foreground">{Number(avgRating).toFixed(1)}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No ratings yet</span>
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="text-sm text-muted-foreground mt-4 whitespace-pre-line">{profile.bio}</p>
        )}

        <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{profile.completed_projects_count}</span> projects completed
          </span>
        </div>
      </div>

      {/* Skills */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Skills</h2>
        {profile.skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <span
                key={skill.id}
                className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-sm"
              >
                {skill.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No skills listed.</p>
        )}
      </div>

      {/* Portfolio */}
      {profile.portfolio_items.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Portfolio</h2>
          <div className="space-y-3">
            {profile.portfolio_items.map((item) => (
              <div key={item.id} className="p-3 rounded-lg bg-secondary/50 border border-border">
                <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                )}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-1 inline-block"
                  >
                    {item.url}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Reviews</h2>
        {reviewsLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-border last:border-0 pb-4 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={`h-4 w-4 ${star <= review.rating_overall ? "text-yellow-500" : "text-muted"}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-foreground mt-2">{review.comment}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {review.review_type === "CLIENT_TO_FREELANCER" ? "From client" : "From freelancer"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        )}
      </div>
    </div>
  );
}
