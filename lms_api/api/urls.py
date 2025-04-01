from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from .views import (
    AdminActivitiesView,
    AdminProjectListView,
    AllUsersView,
    DashboardStatsView,
    # EmailUpdateView,
    LogoutView,
    NotificationView,
    ProfileSettingsView,
    ProjectDetailView,
    RegisterView,
    LoginView,
    ProjectCreateView,
    ProjectListView,
    ProjectUpdateView,
    RewardView,
    UpdatePassword,
    UserCreateView,
    AdminUserDetailView,
    AdminProjectDetailView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', ProfileSettingsView.as_view(), name='user-profile'),
    # path('update-email/', EmailUpdateView.as_view(), name='update-email'),
    path('update-password/', UpdatePassword.as_view(), name='update-password'),
    path('projects/', ProjectListView.as_view(), name='project-list'),
    path('projects/create/', ProjectCreateView.as_view(), name='project-create'),
    path('projects/update/<int:project_id>/', ProjectUpdateView.as_view(), name='project-update'),
    path('projects/<int:project_id>/', ProjectDetailView.as_view(), name='project-detail'),
    path('projects/delete/<int:project_id>/', ProjectListView.as_view(), name='project-delete'),
    path('notifications/', NotificationView.as_view(), name='notifications'),
    path('reward/', RewardView.as_view(), name='user-points'),

    #Admin urls
    path('admin/all-users/', AllUsersView.as_view(), name='all-users'),
    path('admin/new-user/', UserCreateView.as_view(), name='add-new-user'),
    path('admin/user/<int:user_id>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/dashboard-stats/', DashboardStatsView.as_view(), name='add-new-user'),
    path('admin/activities/', AdminActivitiesView.as_view(), name='admin-activities'),

    path('admin/projects/', AdminProjectListView.as_view(), name='project-list'),
    path('admin/projects/<int:project_id>/', AdminProjectDetailView.as_view(), name='project-detail'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)