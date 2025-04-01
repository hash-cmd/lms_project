from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import datetime, timedelta
from django.core.validators import FileExtensionValidator

class CustomUser(AbstractUser):
    email = models.EmailField(unique=True, verbose_name="email address")
    first_name = models.CharField(max_length=30, blank=True)
    last_name = models.CharField(max_length=30, blank=True)
    reward = models.PositiveIntegerField(default=0)
    profile_picture = models.ImageField(
        upload_to='profile_pics/',
        blank=True,
        null=True,
        validators=[FileExtensionValidator(allowed_extensions=['jpg', 'jpeg', 'png'])],
        help_text="Upload a profile picture (JPG/PNG)"
    )
    updated_at = models.DateTimeField(auto_now=True)  # Helpful for cache busting

    USERNAME_FIELD = 'email'  
    REQUIRED_FIELDS = ['username']

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.username or self.email

    def delete(self, *args, **kwargs):
        """Delete the associated profile picture when user is deleted"""
        if self.profile_picture:
            storage, path = self.profile_picture.storage, self.profile_picture.path
            super().delete(*args, **kwargs)
            storage.delete(path)
        else:
            super().delete(*args, **kwargs)



class Project(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, null=True)  # Optional category field
    start_date = models.CharField(max_length=255, blank=True, null=True)
    end_date = models.CharField(max_length=255, blank=True, null=True)
    start_time = models.CharField(max_length=255, blank=True, null=True)
    end_time = models.CharField(max_length=255, blank=True, null=True)
    phases = models.JSONField(default=dict)  # Store phases in list format
    completed = models.BooleanField(default=False)
    completed_at = models.CharField(max_length=255, blank=True, null=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='projects')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValidationError("End date cannot be before start date.")
        if self.start_time and self.end_time and self.start_time > self.end_time:
            raise ValidationError("End time cannot be before start time.")

    def __str__(self):
        return self.title
