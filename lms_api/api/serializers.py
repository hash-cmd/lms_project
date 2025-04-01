import logging
from django.utils import timezone
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import authenticate
from .models import CustomUser, Project
from django.core.files.storage import default_storage
from django.core.exceptions import ValidationError
from django.conf import settings
from django.contrib.auth import get_user_model
import os

CustomUser = get_user_model()
logger = logging.getLogger(__name__)

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    

    class Meta:
        model = CustomUser
        fields = ['username', 'email', 'username', 'password', 'first_name', 'last_name']

    def create(self, validated_data):
        user = CustomUser.objects.create_user(**validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get('email').lower()  # Normalize email to lowercase
        password = data.get('password')

        if not email or not password:
            raise serializers.ValidationError('Both email and password are required')

        # Get user by email (case-insensitive)
        user = CustomUser.objects.filter(email__iexact=email).first()
        
        if not user:
            logger.warning(f"Login attempt with non-existent email: {email}")
            raise serializers.ValidationError('Invalid credentials')

        # Check password directly (bypasses authentication backend)
        if not user.check_password(password):
            logger.warning(f"Invalid password for user: {user.email}")
            raise serializers.ValidationError('Invalid credentials')

        # Manual authentication (since we're bypassing the backend)
        if not user.is_active:
            user.is_active = True
            user.save(update_fields=['is_active'])

        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        data['user'] = user
        return data


class ProfileSerializer(serializers.ModelSerializer):
    profile_picture = serializers.ImageField(
        required=False, 
        allow_null=True,
        write_only=True,
        max_length=None,
        allow_empty_file=False
    )
    profile_picture_url = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 
            'first_name', 'last_name', 'is_active', 'is_superuser',
            'profile_picture', 'profile_picture_url', 'date_joined',
            'password'
        ]
        extra_kwargs = {
            'password': {'write_only': True, 'required': False},
            'username': {'read_only': True},
        }

    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return f"{settings.BASE_URL}{obj.profile_picture.url}"
        return None

    def validate_profile_picture(self, value):
        if value:
            # Validate file size (5MB limit)
            max_size = 5 * 1024 * 1024  # 5MB
            if value.size > max_size:
                raise ValidationError(f"Image file too large ( > {max_size//1024//1024}MB )")
            
            # Validate file extension
            valid_extensions = ['.jpg', '.jpeg', '.png', '.gif']
            ext = os.path.splitext(value.name)[1].lower()
            if ext not in valid_extensions:
                raise ValidationError(f"Unsupported file extension. Supported: {', '.join(valid_extensions)}")
            
            # Validate content type
            valid_content_types = ['image/jpeg', 'image/png', 'image/gif']
            if hasattr(value, 'content_type') and value.content_type not in valid_content_types:
                raise ValidationError(f"Unsupported file type. Supported: {', '.join(valid_content_types)}")
        return value

    def update(self, instance, validated_data):
        # Handle password separately
        password = validated_data.pop('password', None)
        if password:
            instance.set_password(password)
        
        # Handle profile picture
        profile_picture = validated_data.pop('profile_picture', None)
        
        # If profile_picture is explicitly set to None, delete existing picture
        if profile_picture is None and 'profile_picture' in self.initial_data:
            self._delete_profile_picture(instance)
            instance.profile_picture = None
        elif profile_picture:
            # Delete old picture if it exists
            if instance.profile_picture:
                self._delete_profile_picture(instance)
            instance.profile_picture = profile_picture
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        instance.save()
        return instance

    def _delete_profile_picture(self, instance):
        """Safely delete old profile picture from storage"""
        if instance.profile_picture:
            try:
                if default_storage.exists(instance.profile_picture.name):
                    default_storage.delete(instance.profile_picture.name)
            except Exception as e:
                # Log the error but don't fail the operation
                print(f"Error deleting profile picture: {str(e)}")
    


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            'id', 'title', 'description', 'category', 
            'start_date', 'end_date', 'start_time', 
            'end_time', 'phases', 'completed', 'completed_at', 'user', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user']

    def create(self, validated_data):
        # Automatically assign the user from request context
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Update only the fields that were passed
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
    


class UserCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            'username', 
            'email', 
            'first_name', 
            'last_name', 
            'password',
            'is_superuser'
        ]
        extra_kwargs = {
            'password': {'write_only': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
        }

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        user = CustomUser.objects.create_user(**validated_data)
        return user
    



class AdminUserDetailSerializer(serializers.ModelSerializer):
    profile_picture_url = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomUser
        fields = [
            'id',
            'first_name',
            'last_name',
            'username',
            'email',
            'profile_picture',  # Include the actual field
            'profile_picture_url',  # Include the URL field
            'date_joined',
            'is_superuser',
            'is_active',
            'last_login'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']

    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None



class AdminProjectSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_full_name = serializers.SerializerMethodField()
    user_profile_picture = serializers.SerializerMethodField()
    phases_count = serializers.SerializerMethodField()
    time_remaining = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    
    class Meta:
        model = Project
        fields = [
            'id',
            'title',
            'description',
            'category',
            'start_date',
            'end_date',
            'start_time',
            'end_time',
            'phases',
            'completed',
            'completed_at',
            'user',
            'user_email',
            'user_full_name',
            'user_profile_picture',
            'phases_count',
            'time_remaining',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user']
    
    def get_user_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() if obj.user else None
    
    def get_user_profile_picture(self, obj):
        if obj.user.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.user.profile_picture.url)
            return obj.user.profile_picture.url
        return None
    
    def get_phases_count(self, obj):
        return len(obj.phases) if obj.phases else 0
    
    def get_time_remaining(self, obj):
        if not obj.end_date or not obj.end_time or obj.completed:
            return None
            
        try:
            end_datetime = timezone.make_aware(
                datetime.strptime(f"{obj.end_date} {obj.end_time}", "%Y-%m-%d %H:%M")
            )
            remaining = end_datetime - timezone.now()
            return max(0, remaining.total_seconds())  # Returns seconds remaining
        except:
            return None
    
    def get_is_active(self, obj):
        if obj.completed:
            return False
            
        if not obj.start_date or not obj.start_time:
            return True
            
        try:
            start_datetime = timezone.make_aware(
                datetime.strptime(f"{obj.start_date} {obj.start_time}", "%Y-%m-%d %H:%M")
            )
            return timezone.now() >= start_datetime
        except:
            return True