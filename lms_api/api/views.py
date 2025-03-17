import logging
from rest_framework import generics
from .serializers import LoginSerializer, ProfileSerializer, RegisterSerializer, ProjectSerializer
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Project
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import get_user_model

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
        if serializer.is_valid():
            user = serializer.validated_data['user']
            refresh = RefreshToken.for_user(user)
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
                    'reward': user.reward,
                    'profile_picture': user.profile_picture,
                }
            }, status=status.HTTP_200_OK)
        logger.error(f"Login failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                logger.warning("Refresh token required for logout")
                return Response({"error": "Refresh token required"}, status=status.HTTP_400_BAD_REQUEST)

            token = RefreshToken(refresh_token)
            token.blacklist()
            logger.info(f"User {request.user.username} logged out successfully")
            return Response({"message": "Logged out successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Logout failed: {str(e)}")
            return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)

class ProfileSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        serializer = ProfileSerializer(request.user)
        logger.info(f"Profile data retrieved for user {request.user.username}")
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, *args, **kwargs):
        user = request.user
        serializer = ProfileSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            logger.info(f"Profile updated for user {request.user.username}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        logger.error(f"Profile update failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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