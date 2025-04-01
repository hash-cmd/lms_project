from django.utils import timezone
from datetime import datetime, timedelta
import logging
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import generics
from .serializers import LoginSerializer, ProfileSerializer, RegisterSerializer, ProjectSerializer, UserCreateSerializer, AdminUserDetailSerializer, AdminProjectSerializer
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Project
from django.core.files.storage import default_storage
from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from django.core.paginator import Paginator
from rest_framework.pagination import PageNumberPagination
from django.contrib.auth import update_session_auth_hash
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password 
from django.db.models import Q, F, Count, DateTimeField, Value
from django.core.exceptions import PermissionDenied
import uuid
from django.db.models.functions import Cast, Concat


# Create a logger instance
logger = logging.getLogger(__name__)

CustomUser = get_user_model()

class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.error(f"Login validation errors: {serializer.errors}")
            return Response(
                {'error': 'Invalid input', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = serializer.validated_data['user']
            refresh = RefreshToken.for_user(user)
            
            profile_picture_url = user.profile_picture.url if user.profile_picture else None
            
            logger.info(f"User {user.username} logged in successfully")

            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'is_superuser': user.is_superuser,
                    'reward': user.reward,
                    'profile_picture': profile_picture_url,
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Login error: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred during login'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                logger.warning("Refresh token required for logout")
                return Response({"error": "Refresh token required"}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                user = CustomUser.objects.get(email=request.user.email)
            except CustomUser.DoesNotExist:
                return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

            user.is_active = False
            user.save()

            token = RefreshToken(refresh_token)
            token.blacklist()
            logger.info(f"User {request.user.username} logged out successfully")
            return Response({"message": "Logged out successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Logout failed: {str(e)}")
            return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)
        



class UserCreateView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = UserCreateSerializer(data=request.data)
        if serializer.is_valid():
            try:
                validate_password(serializer.validated_data['password'])
                user = serializer.save()
                return Response({
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'is_superuser': user.is_superuser
                }, status=status.HTTP_201_CREATED)
            except ValidationError as e:
                return Response({'password': e.messages}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class AdminUserDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request, user_id, *args, **kwargs):
        try:
            user = CustomUser.objects.get(id=user_id)
            serializer = AdminUserDetailSerializer(
                user, 
                context={'request': request}
            )
            return Response(serializer.data)
        except CustomUser.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )

    def patch(self, request, user_id, *args, **kwargs):
        try:
            user = CustomUser.objects.get(id=user_id)
            serializer = AdminUserDetailSerializer(
                user, 
                data=request.data, 
                partial=True,
                context={'request': request}
            )
            
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except CustomUser.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        

    def delete(self, request, user_id, *args, **kwargs):
        try:
            user = CustomUser.objects.get(id=user_id)
            
            # Prevent admin from deleting themselves
            if user == request.user:
                return Response(
                    {"error": "You cannot delete your own account"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Prevent deletion of superusers by non-superusers
            if user.is_superuser and not request.user.is_superuser:
                return Response(
                    {"error": "Only superusers can delete other superusers"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            user.delete()
            return Response(
                {"message": "User deleted successfully"},
                status=status.HTTP_204_NO_CONTENT
            )
            
        except CustomUser.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )


class ProfileSettingsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]  # For file uploads
    
    def get(self, request):
        """
        Retrieve complete user profile data
        Returns:
        - User details (username, email, names)
        - Profile picture URL (absolute)
        - Other profile fields
        """
        try:
            serializer = ProfileSerializer(request.user, context={'request': request})
            logger.info(f"Profile data retrieved for user {request.user.username}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving profile: {str(e)}")
            return Response(
                {"error": "Failed to retrieve profile data"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request):
        """
        Update user profile with partial or complete data
        Handles:
        - Profile picture uploads/deletion
        - Basic info updates (email, names)
        - Password changes
        - Other custom profile fields
        """
        try:
            user = request.user
            data = request.data.copy()
            
            
            # Handle profile picture operations
            if 'profile_picture' in request.FILES:
                data['profile_picture'] = request.FILES['profile_picture']
            elif 'profile_picture' in data and data['profile_picture'] in ['null', '']:
                # Handle profile picture removal
                if user.profile_picture:
                    self._delete_profile_picture(user)
                data['profile_picture'] = None
            
            serializer = ProfileSerializer(
                user,
                data=data,
                partial=True,
                context={'request': request}
            )
            
            if not serializer.is_valid():
                logger.warning(f"Profile update validation failed: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            # Handle password change separately
            password = data.get('password')
            if password:
                if len(password) < 8:
                    return Response(
                        {'password': 'Password must be at least 8 characters long'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                user.set_password(password)
                user.save()
                logger.info(f"Password updated for user {user.username}")
            
            # Save other profile changes
            serializer.save()
            logger.info(f"Profile updated for user {user.username}")
            return Response(serializer.data)
            
        except ValidationError as e:
            logger.error(f"Profile update validation error: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Profile update error: {str(e)}")
            return Response(
                {'error': 'An unexpected error occurred'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _delete_profile_picture(self, user):
        """Safely delete old profile picture from storage"""
        if user.profile_picture:
            try:
                if default_storage.exists(user.profile_picture.name):
                    default_storage.delete(user.profile_picture.name)
                    logger.info(f"Deleted old profile picture for user {user.username}")
            except Exception as e:
                logger.error(f"Error deleting profile picture: {str(e)}")
                # Continue even if deletion fails




# class EmailUpdateView(APIView):
#     permission_classes = [IsAuthenticated]
    
#     def post(self, request):
#         """
#         Handle email updates with verification
#         Required payload:
#         {
#             "new_email": "new@example.com"
#         }
#         """
#         try:
#             user = request.user
#             new_email = request.data.get('new_email')
            
#             # Validate new email
#             if not new_email:
#                 raise ValidationError({'new_email': 'This field is required'})
            
#             if new_email == user.email:
#                 raise ValidationError({'new_email': 'New email must be different from current email'})
            
#             # Check if email already exists
#             if CustomUser.objects.filter(email=new_email).exclude(pk=user.pk).exists():
#                 raise ValidationError({'new_email': 'This email is already in use'})
            
#             # Update email (but don't save yet)
#             user.email = new_email
#             user.is_active = False  # Deactivate until verified
#             user.save()
            
            
#             return Response(
#                 {
#                     'detail': 'Email updated successfully. Please check your new email for verification instructions.',
#                     'email': new_email
#                 },
#                 status=status.HTTP_200_OK
#             )
            
#         except ValidationError as e:
#             logger.warning(f"Email update validation failed for user {request.user.id}: {e.detail}")
#             return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
#         except Exception as e:
#             logger.error(f"Email update error for user {request.user.id}: {str(e)}", exc_info=True)
#             return Response(
#                 {'error': 'An error occurred while updating your email'},
#                 status=status.HTTP_500_INTERNAL_SERVER_ERROR
#             )
    
    # def send_verification_email(self, user):
    #     """Generate and send verification email"""
    #     token = default_token_generator.make_token(user)
    #     uid = urlsafe_base64_encode(force_bytes(user.pk))
        
    #     subject = "Verify your new email address"
    #     message = render_to_string('email_verification.html', {
    #         'user': user,
    #         'domain': settings.FRONTEND_DOMAIN,
    #         'uid': uid,
    #         'token': token,
    #     })
        
    #     send_mail(
    #         subject,
    #         message,
    #         settings.DEFAULT_FROM_EMAIL,
    #         [user.email],
    #         fail_silently=False,
    #     )




class UpdatePassword(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        # Validate all fields are present
        if not all([current_password, new_password, confirm_password]):
            return Response(
                {'error': 'All fields are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if new passwords match
        if new_password != confirm_password:
            return Response(
                {'error': 'New passwords do not match'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify current password
        if not user.check_password(current_password):
            return Response(
                {'error': 'Current password is incorrect'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate new password meets requirements
        try:
            validate_password(new_password, user)
        except ValidationError as e:
            return Response(
                {'error': e.messages},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Set new password
        user.set_password(new_password)
        user.save()

        # Update session auth hash to prevent logout
        update_session_auth_hash(request, user)

        # Optional: Invalidate existing tokens (JWT specific)
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass  # Token invalidation is optional

        logger.info(f"Password updated successfully for user {user.username}")
        return Response(
            {'success': 'Password updated successfully'},
            status=status.HTTP_200_OK
        )


class ProjectCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = ProjectSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(user=request.user)
            logger.info(f"Project created by user {request.user.username}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        logger.error(f"Project creation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class ProjectListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        projects = Project.objects.filter(user=request.user).order_by('-created_at')
        logger.debug(f"Projects queryset for user {request.user.username}: {projects}")
        serializer = ProjectSerializer(projects, many=True)
        logger.debug(f"Serialized projects data: {serializer.data}")
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, project_id, *args, **kwargs):
        try:
            project = Project.objects.get(id=project_id, user=request.user)
            project.delete()
            logger.info(f"Project {project_id} deleted by user {request.user.username}")
            return Response({"message": "Project deleted successfully"}, status=status.HTTP_204_NO_CONTENT)
        except Project.DoesNotExist:
            logger.error(f"Project {project_id} not found for user {request.user.username}")
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)



class ProjectDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id, *args, **kwargs):
        try:
            project = Project.objects.get(id=project_id, user=request.user)
            serializer = ProjectSerializer(project)
            logger.info(f"Project {project_id} retrieved by user {request.user.username}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Project.DoesNotExist:
            logger.error(f"Project {project_id} not found for user {request.user.username}")
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, project_id, *args, **kwargs):
        try:
            project = Project.objects.get(id=project_id, user=request.user)
            project.delete()
            logger.info(f"Project {project_id} deleted by user {request.user.username}")
            return Response({"message": "Project deleted successfully"}, status=status.HTTP_204_NO_CONTENT)
        except Project.DoesNotExist:
            logger.error(f"Project {project_id} not found for user {request.user.username}")
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)



class ProjectUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, project_id, *args, **kwargs):
        try:
            project = Project.objects.get(id=project_id, user=request.user)
            logger.debug(f"Fetched project for update: {project}")
        except Project.DoesNotExist:
            logger.error(f"Project {project_id} not found for user {request.user.username}")
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

        logger.debug(f"Request data for project update: {request.data}")
        serializer = ProjectSerializer(project, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            if request.data.get('completed', False) and not project.completed:
                user = request.user
                user.reward += 3
                user.save()
                logger.info(f"Added 3 reward points to user {user.username}. New reward: {user.reward}")

            serializer.save()
            logger.debug(f"Updated project data: {serializer.data}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        logger.error(f"Project update failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class NotificationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = []
        projects = Project.objects.filter(user=request.user)
        for project in projects:
            notifications.extend(project.check_for_notifications())
        logger.info(f"Notifications retrieved for user {request.user.username}")
        return Response(notifications, status=status.HTTP_200_OK)



class RewardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        reward_points = request.user.reward
        logger.info(f"Reward points retrieved for user {request.user.username}: {reward_points}")
        return Response({'points': reward_points}, status=status.HTTP_200_OK)
    


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            today = timezone.now().date()
            time_threshold = timezone.now() - timedelta(days=7)
            
            # Get basic stats
            total_users = CustomUser.objects.count()
            new_users_today = CustomUser.objects.filter(
                date_joined__date=today
            ).count()
            active_users_today = CustomUser.objects.filter(
                last_login__date=today
            ).count()
            total_projects = Project.objects.count()
            
            # Project status counts
            projects_completed = Project.objects.filter(completed=True).count()
            projects_in_progress = Project.objects.filter(completed=False).count()
            
            # Calculate completion metrics
            projects_on_time = 0
            projects_late = 0
            on_time_percentage = 0
            late_percentage = 0
            
            try:
                # Get completed projects with valid dates
                completed_projects = Project.objects.filter(
                    completed=True,
                    end_date__isnull=False,
                    completed_at__isnull=False
                )
                
                for project in completed_projects:
                    try:
                        # Handle case where end_time might be None or empty
                        end_time_str = project.end_time or "23:59"  # Default to end of day
                        
                        # Create end datetime
                        end_datetime = datetime.combine(
                            project.end_date,
                            datetime.strptime(end_time_str, "%H:%M").time()
                        ).replace(tzinfo=timezone.utc)
                        
                        if project.completed_at <= end_datetime:
                            projects_on_time += 1
                        else:
                            projects_late += 1
                    except (ValueError, TypeError, AttributeError) as e:
                        logger.error(f"Error processing project {project.id}: {str(e)}")
                        continue
                
                # Calculate percentages based only on counted projects
                total_counted = projects_on_time + projects_late
                if total_counted > 0:
                    on_time_percentage = round((projects_on_time / total_counted) * 100)
                    late_percentage = round((projects_late / total_counted) * 100)
                
            except Exception as e:
                logger.error(f"Error calculating completion metrics: {str(e)}")

            # Daily visits - using active users as proxy
            daily_visits = active_users_today

            # Get recent activities
            recent_users = CustomUser.objects.filter(
                date_joined__gte=time_threshold
            ).order_by('-date_joined')[:5]
            
            recent_projects = Project.objects.filter(
                created_at__gte=time_threshold
            ).order_by('-created_at')[:5]

            # Format activities
            activities = []
            for user in recent_users:
                activities.append({
                    'type': 'user_signup',
                    'title': f'New user: {user.email}',
                    'timestamp': user.date_joined.isoformat(),
                    'time_ago': self.get_time_ago(user.date_joined),
                    'icon': 'person-add'
                })
            
            for project in recent_projects:
                activities.append({
                    'type': 'project_created',
                    'title': f'New project: {project.title}',
                    'timestamp': project.created_at.isoformat(),
                    'time_ago': self.get_time_ago(project.created_at),
                    'icon': 'document-text'
                })
            
            # Sort by timestamp (newest first)
            activities.sort(key=lambda x: x['timestamp'], reverse=True)
            
            return Response({
                'status': 'success',
                'stats': {
                    'total_users': total_users,
                    'new_users_today': new_users_today,
                    'active_users_today': active_users_today,
                    'total_projects': total_projects,
                    'projects_completed': projects_completed,
                    'projects_in_progress': projects_in_progress,
                    'projects_on_time': projects_on_time,
                    'projects_late': projects_late,
                    'on_time_percentage': on_time_percentage,
                    'late_percentage': late_percentage,
                    'daily_visits': daily_visits,
                },
                'recent_activities': activities[:10]
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Unexpected error in dashboard stats: {str(e)}")
            return Response({
                'status': 'error',
                'message': 'Internal server error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def get_time_ago(self, timestamp):
        """Convert timestamp to human-readable time ago format"""
        try:
            now = timezone.now()
            diff = now - timestamp
            
            if diff.days > 0:
                return f'{diff.days} day(s) ago'
            elif diff.seconds > 3600:
                hours = diff.seconds // 3600
                return f'{hours} hour(s) ago'
            else:
                minutes = diff.seconds // 60
                return f'{minutes} minute(s) ago'
        except Exception as e:
            logger.error(f"Error in get_time_ago: {str(e)}")
            return "recently"


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
    django_paginator_class = Paginator

    def get_paginated_response(self, data):
        return Response({
            'links': {
                'next': self.get_next_link(),
                'previous': self.get_previous_link()
            },
            'count': self.page.paginator.count,
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
            'results': data
        })

class AllUsersView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    
    def get(self, request, **kwargs):
        users = CustomUser.objects.all().order_by('-date_joined')
        page = self.paginate_queryset(users)
        if page is not None:
            serializer = ProfileSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = ProfileSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @property
    def paginator(self):
        if not hasattr(self, '_paginator'):
            if self.pagination_class is None:
                self._paginator = None
            else:
                self._paginator = self.pagination_class()
        return self._paginator
    
    def paginate_queryset(self, queryset):
        if self.paginator is None:
            return None
        return self.paginator.paginate_queryset(queryset, self.request, view=self)
    
    def get_paginated_response(self, data):
        assert self.paginator is not None
        return self.paginator.get_paginated_response(data)
    




class AdminProjectListView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request, *args, **kwargs):
        try:
            # Get query parameters
            search = request.query_params.get('search', '')
            status_filter = request.query_params.get('status', 'all')
            user_id = request.query_params.get('user_id')
            category = request.query_params.get('category')
            time_frame = request.query_params.get('time_frame')  # today, week, month, overdue
            
            # Base queryset - admin can see all projects
            projects = Project.objects.select_related('user').all()
            
            # Filter by specific user if requested
            if user_id:
                projects = projects.filter(user__id=user_id)
            
            # Apply search filter
            if search:
                projects = projects.filter(
                    Q(title__icontains=search) | 
                    Q(description__icontains=search) |
                    Q(category__icontains=search) |
                    Q(user__email__icontains=search) |
                    Q(user__first_name__icontains=search) |
                    Q(user__last_name__icontains=search))
            
            # Apply category filter
            if category:
                projects = projects.filter(category__iexact=category)
            
            # Apply status filter
            if status_filter == 'active':
                projects = projects.filter(completed=False)
            elif status_filter == 'completed':
                projects = projects.filter(completed=True)
            
            # Apply time frame filters
            if time_frame:
                today = timezone.now().date()
                if time_frame == 'today':
                    projects = projects.filter(
                        Q(start_date=today) | Q(end_date=today))
                elif time_frame == 'week':
                    next_week = today + timedelta(days=7)
                    projects = projects.filter(
                        end_date__range=[today, next_week])
                elif time_frame == 'month':
                    next_month = today + timedelta(days=30)
                    projects = projects.filter(
                        end_date__range=[today, next_month])
                elif time_frame == 'overdue':
                    projects = projects.filter(
                        end_date__lt=today,
                        completed=False)
            
            # Order by most recent
            projects = projects.order_by('-created_at')
            
            serializer = AdminProjectSerializer(projects, many=True, context={'request': request})
            return Response({
                'status': 'success',
                'projects': serializer.data,
                'count': projects.count()
            })
            
        except Exception as e:
            return Response(
                {'status': 'error', 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        


class AdminProjectDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_object(self, project_id):
        try:
            return Project.objects.select_related('user').get(id=project_id)
        except Project.DoesNotExist:
            return None

    def get(self, request, project_id, *args, **kwargs):
        project = self.get_object(project_id)
        if not project:
            return Response(
                {'status': 'error', 'message': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )
            
        serializer = AdminProjectSerializer(project, context={'request': request})
        return Response({
            'status': 'success',
            'project': serializer.data
        })

    def patch(self, request, project_id, *args, **kwargs):
        project = self.get_object(project_id)
        if not project:
            return Response(
                {'status': 'error', 'message': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )
            
        serializer = AdminProjectSerializer(
            project, 
            data=request.data, 
            partial=True,
            context={'request': request}
        )
        
        if serializer.is_valid():
            serializer.save()
            
            # Handle completion status change
            if 'completed' in request.data:
                if request.data['completed'] and not project.completed_at:
                    project.completed_at = timezone.now().strftime("%Y-%m-%d %H:%M")
                    project.save()
                elif not request.data['completed']:
                    project.completed_at = None
                    project.save()
            
            return Response({
                'status': 'success',
                'project': serializer.data
            })
        return Response(
            {'status': 'error', 'errors': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(self, request, project_id, *args, **kwargs):
        project = self.get_object(project_id)
        if not project:
            return Response(
                {'status': 'error', 'message': 'Project not found'},
                status=status.HTTP_404_NOT_FOUND
            )
            
        project.delete()
        return Response(
            {'status': 'success', 'message': 'Project deleted successfully'},
            status=status.HTTP_204_NO_CONTENT
        )



class AdminActivitiesView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        try:
            # Validate pagination parameters
            try:
                page = int(request.query_params.get('page', 1))
                page_size = min(int(request.query_params.get('page_size', 20)), 50)
            except ValueError:
                return Response(
                    {'status': 'error', 'message': 'Invalid pagination parameters'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            time_threshold = timezone.now() - timedelta(days=30)
            activities = []
            
            # Helper function to safely get user info
            def get_user_info(user):
                return {
                    'email': getattr(user, 'email', 'Unknown'),
                    'full_name': getattr(user, 'get_full_name', lambda: 'Unknown')()
                }

            # User signups
            try:
                for user in CustomUser.objects.filter(date_joined__gte=time_threshold).order_by('-date_joined'):
                    user_info = get_user_info(user)
                    activities.append({
                        'uuid': str(uuid.uuid4()),
                        'id': f'user_{user.id}',
                        'type': 'user_signup',
                        'title': f'New user registered: {user_info["email"]}',
                        'description': f"User {user_info['full_name']} joined the system",
                        'timestamp': user.date_joined.isoformat(),
                        'time_ago': self.get_time_ago(user.date_joined),
                        'icon': 'person-add',
                        'user_id': user.id
                    })
            except Exception as e:
                logger.error(f"Error processing user activities: {str(e)}")

            # Project creations
            try:
                for project in Project.objects.filter(created_at__gte=time_threshold).order_by('-created_at'):
                    user_info = get_user_info(project.user)
                    activities.append({
                        'uuid': str(uuid.uuid4()),
                        'id': f'project_{project.id}',
                        'type': 'project_created',
                        'title': f'New project created: {getattr(project, "title", "Untitled")}',
                        'description': f"Created by {user_info['email']}",
                        'timestamp': project.created_at.isoformat(),
                        'time_ago': self.get_time_ago(project.created_at),
                        'icon': 'folder',
                        'project_id': project.id,
                        'user_id': project.user.id
                    })
            except Exception as e:
                logger.error(f"Error processing project creations: {str(e)}")

            # Project updates
            try:
                for project in Project.objects.filter(updated_at__gte=time_threshold).exclude(updated_at=F('created_at')).order_by('-updated_at'):
                    user_info = get_user_info(project.user)
                    activities.append({
                        'uuid': str(uuid.uuid4()),
                        'id': f'project_{project.id}_update',
                        'type': 'project_updated',
                        'title': f'Project updated: {getattr(project, "title", "Untitled")}',
                        'description': f"Updated by {user_info['email']}",
                        'timestamp': project.updated_at.isoformat(),
                        'time_ago': self.get_time_ago(project.updated_at),
                        'icon': 'create',
                        'project_id': project.id,
                        'user_id': project.user.id
                    })
            except Exception as e:
                logger.error(f"Error processing project updates: {str(e)}")

            # Project completions
            try:
                for project in Project.objects.filter(completed_at__gte=time_threshold).order_by('-completed_at'):
                    user_info = get_user_info(project.user)
                    activities.append({
                        'uuid': str(uuid.uuid4()),
                        'id': f'project_{project.id}_complete',
                        'type': 'project_completed',
                        'title': f'Project completed: {getattr(project, "title", "Untitled")}',
                        'description': f"Completed by {user_info['email']}",
                        'timestamp': project.completed_at.isoformat(),
                        'time_ago': self.get_time_ago(project.completed_at),
                        'icon': 'checkmark-circle',
                        'project_id': project.id,
                        'user_id': project.user.id
                    })
            except Exception as e:
                logger.error(f"Error processing project completions: {str(e)}")

            # Sort all activities by timestamp (newest first)
            activities.sort(key=lambda x: x['timestamp'], reverse=True)
            
            # Pagination
            total_activities = len(activities)
            start = (page - 1) * page_size
            end = start + page_size
            paginated_activities = activities[start:end]
            
            return Response({
                'status': 'success',
                'activities': paginated_activities,
                'total': total_activities,
                'page': page,
                'page_size': page_size,
                'has_more': end < total_activities
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.exception("Unexpected error in AdminActivitiesView")
            return Response({
                'status': 'error',
                'message': 'An unexpected error occurred'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def get_time_ago(self, timestamp):
        """Convert timestamp to human-readable time ago format"""
        try:
            now = timezone.now()
            diff = now - timestamp
            
            if diff.days > 0:
                return f'{diff.days} day(s) ago'
            elif diff.seconds >= 3600:
                hours = diff.seconds // 3600
                return f'{hours} hour(s) ago'
            elif diff.seconds >= 60:
                minutes = diff.seconds // 60
                return f'{minutes} minute(s) ago'
            return 'Just now'
        except:
            return 'Recently'