"use client"

import { useSession, signOut } from "@/lib/auth-client";
import { useUserTopics } from "@/hooks/useUserTopics";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ErrorContext } from "better-auth/react";
import { Loader2, FileText } from "lucide-react";
import Block from "@/components/content/Block";

const Profile = () => {
    const { data: session } = useSession();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const router = useRouter();
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Get user's topics with pagination
    const { data: userTopics, isLoading: topicsLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useUserTopics();

    // Intersection Observer for infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { threshold: 0.1 }
        );

        const currentRef = loadMoreRef.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const handleLogout = async () => {
        await signOut({
            fetchOptions: {
                onRequest: () => {
                    setIsLoggingOut(true);
                },
                onSuccess: () => {
                    toast.success("You have been logged out successfully!");
                    router.push("/");
                    router.refresh();
                    setIsLoggingOut(false);
                },
                onError: (error: ErrorContext) => {
                    console.error("Error during logout:", error);
                    toast.error("An error occurred while logging out. Please try again.");
                    setIsLoggingOut(false);
                },
            },
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl xs:text-4xl lg:text-4xl/normal font-light">Profile</h1>
                <p className="text-muted-foreground">Manage your account settings</p>
            </div>

            {session && (
                <div className="mt-8 flex flex-col gap-6">
                    <div className="flex items-center gap-6">
                        <Avatar className="size-20 ring-2 ring-white/20 dark:ring-white/10 shadow-lg">
                            <AvatarImage src={session.user?.image ?? undefined} />
                            <AvatarFallback className="text-xl font-medium bg-gradient-to-br from-primary/30 to-primary/20 backdrop-blur-sm">
                                {session.user?.name?.substring(0, 1) ?? ":)"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                            <h3 className="text-xl font-semibold text-foreground/90">
                                {session.user?.name ?? "User"}
                            </h3>
                            {session.user?.email && !session.user?.isAnonymous && (
                                <p className="text-sm text-muted-foreground/80">
                                    {session.user.email}
                                </p>
                            )}
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                    >
                        {isLoggingOut ? "Logging out..." : "Logout"}
                    </Button>
                </div>
            )}

            {/* User's Topics Section */}
            {session?.user?.id && (
                <div className="space-y-4 pt-6">
                    <div>
                        <h2 className="text-xl font-semibold">My Topics</h2>
                        <p className="text-muted-foreground">{`Topics you've requested`}</p>
                    </div>

                    {topicsLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : userTopics && userTopics.length > 0 ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                                {userTopics.map((topic) => (
                                    <Block
                                        key={topic._id}
                                        id={topic._id}
                                        imageUrl={topic.imageUrl}
                                        title={topic.title}
                                        description={topic.description}
                                        likes={topic.likeCount}
                                        shares={topic.shareCount}
                                        difficulty={topic.difficulty}
                                        estimatedReadTime={topic.estimatedReadTime}
                                        viewCount={topic.viewCount}
                                    />
                                ))}
                            </div>
                            
                            {/* Load more trigger */}
                            {hasNextPage && (
                                <div ref={loadMoreRef} className="flex items-center justify-center py-8">
                                    {isFetchingNextPage && (
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground mb-2">No topics created yet</p>
                            <p className="text-sm text-muted-foreground">
                                Start exploring and request topics to see them here!
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Profile;