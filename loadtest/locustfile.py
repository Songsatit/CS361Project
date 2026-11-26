"""Small, repeatable read-heavy workload for the CS361 deployed API."""

import os

from locust import HttpUser, between, task


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


class CurriculumUser(HttpUser):
    """Read-only workload; it never creates or mutates application data."""

    wait_time = between(1, 3)

    def on_start(self):
        self.curriculum_id = env("CURRICULUM_ID", "BSC-CS-2566")
        self.course_code = env("COURSE_CODE", "CS100")
        self.student_path = env("STUDENT_PATH", "")
        self.authenticated = False

        username = env("LOADTEST_USERNAME")
        password = os.getenv("LOADTEST_PASSWORD", "")
        if username and password:
            with self.client.post(
                "/api/auth/login",
                json={"username": username, "password": password},
                name="POST /api/auth/login",
                catch_response=True,
            ) as response:
                if response.status_code == 200:
                    response.success()
                    self.authenticated = True
                else:
                    response.failure(f"login returned HTTP {response.status_code}")

    @task(5)
    def list_courses(self):
        self.client.get(
            "/api/courses",
            params={"curriculumId": self.curriculum_id, "limit": "50"},
            name="GET /api/courses",
        )

    @task(2)
    def read_course(self):
        self.client.get(f"/api/courses/{self.course_code}", name="GET /api/courses/{courseCode}")

    @task(2)
    def read_prerequisites(self):
        self.client.get(
            f"/api/courses/{self.course_code}/prerequisites",
            name="GET /api/courses/{courseCode}/prerequisites",
        )

    @task(2)
    def read_study_plans(self):
        self.client.get(
            "/api/study-plans",
            params={"curriculumId": self.curriculum_id},
            name="GET /api/study-plans",
        )

    @task(1)
    def read_graduation(self):
        if self.authenticated and self.student_path:
            self.client.get(self.student_path, name="GET /api/graduation/me")

