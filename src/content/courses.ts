import type { Course, PlannedCourse } from './types'
import { ckadCourse } from './ckad'

/**
 * Course registry.
 *
 * Adding another DevOps course means building one more `Course` object under
 * `src/content/<course-id>/` and listing it here. Every page reads courses
 * from this registry, so no UI changes are needed.
 */
export const courses: Course[] = [ckadCourse]

/** Announced but not yet written, shown as "coming soon" on the home page. */
export const plannedCourses: PlannedCourse[] = [
  {
    id: 'cka',
    title: 'CKA — Certified Kubernetes Administrator',
    subtitle: 'Cluster operations, etcd, kubeadm, RBAC at cluster scope',
    icon: '🛠️',
    note: 'Planned next. The content model already supports it.',
  },
  {
    id: 'terraform-associate',
    title: 'Terraform Associate',
    subtitle: 'HCL, state, modules, providers, workspaces',
    icon: '🏗️',
    note: 'Planned.',
  },
  {
    id: 'docker-fundamentals',
    title: 'Containers & Docker fundamentals',
    subtitle: 'Images, layers, registries, Compose, build strategy',
    icon: '📦',
    note: 'Planned.',
  },
]

export function getCourse(courseId: string): Course | undefined {
  return courses.find((course) => course.id === courseId)
}

export { ckadCourse }
