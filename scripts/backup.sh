#!/bin/bash

# WanRide MongoDB Backup Script
# Automated backup with S3 upload and cleanup
# Run daily at 2am PNG time via cron

set -euo pipefail

# Configuration
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"
BACKUP_NAME="wanride_${DATE}"
LOG_FILE="/var/log/wanride-backup.log"
RETENTION_DAYS=30

# PNG timezone
export TZ="Pacific/Port_Moresby"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [BACKUP] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Check required environment variables
check_env() {
    local required_vars=("MONGODB_URI" "S3_BUCKET" "AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY")
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error_exit "Required environment variable $var is not set"
        fi
    done
}

# Create backup directory
create_backup_dir() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR" || error_exit "Failed to create backup directory"
        log "Created backup directory: $BACKUP_DIR"
    fi
}

# Perform MongoDB backup
backup_mongodb() {
    log "Starting MongoDB backup: $BACKUP_NAME"
    
    local backup_file="${BACKUP_DIR}/${BACKUP_NAME}.gz"
    
    # Use mongodump with gzip compression
    if mongodump --uri="$MONGODB_URI" --gzip --archive="$backup_file"; then
        log "MongoDB backup completed: $backup_file"
        
        # Get backup file size
        local file_size=$(du -h "$backup_file" | cut -f1)
        log "Backup file size: $file_size"
        
        echo "$backup_file"
    else
        error_exit "MongoDB backup failed"
    fi
}

# Upload to S3
upload_to_s3() {
    local backup_file="$1"
    local s3_path="s3://${S3_BUCKET}/backups/$(basename "$backup_file")"
    
    log "Uploading backup to S3: $s3_path"
    
    if command -v aws >/dev/null 2>&1; then
        if aws s3 cp "$backup_file" "$s3_path"; then
            log "S3 upload completed successfully"
        else
            error_exit "S3 upload failed"
        fi
    else
        log "WARNING: AWS CLI not found, skipping S3 upload"
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    log "Verifying backup integrity"
    
    # Check if file exists and is not empty
    if [[ ! -f "$backup_file" ]]; then
        error_exit "Backup file does not exist: $backup_file"
    fi
    
    if [[ ! -s "$backup_file" ]]; then
        error_exit "Backup file is empty: $backup_file"
    fi
    
    # Test gzip integrity
    if gzip -t "$backup_file"; then
        log "Backup integrity verified"
    else
        error_exit "Backup file is corrupted"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days"
    
    # Local cleanup
    local deleted_count=0
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((deleted_count++))
    done < <(find "$BACKUP_DIR" -name "wanride_*.gz" -mtime +$RETENTION_DAYS -print0)
    
    if [[ $deleted_count -gt 0 ]]; then
        log "Deleted $deleted_count old local backup files"
    else
        log "No old local backup files to delete"
    fi
    
    # S3 cleanup (if AWS CLI is available)
    if command -v aws >/dev/null 2>&1; then
        log "Cleaning up old S3 backups"
        
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" '+%Y-%m-%d')
        
        # List and delete old S3 objects
        aws s3 ls "s3://${S3_BUCKET}/backups/" | while read -r line; do
            local file_date=$(echo "$line" | awk '{print $1}')
            local file_name=$(echo "$line" | awk '{print $4}')
            
            if [[ "$file_date" < "$cutoff_date" ]] && [[ "$file_name" == wanride_*.gz ]]; then
                aws s3 rm "s3://${S3_BUCKET}/backups/$file_name"
                log "Deleted old S3 backup: $file_name"
            fi
        done
    fi
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    # Send to Slack webhook if configured
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local emoji="✅"
        local color="good"
        
        if [[ "$status" == "error" ]]; then
            emoji="❌"
            color="danger"
        fi
        
        local payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "${emoji} WanRide Backup $status",
            "text": "$message",
            "footer": "WanRide Backup System",
            "ts": $(date +%s)
        }
    ]
}
EOF
)
        
        curl -X POST -H 'Content-type: application/json' \
             --data "$payload" \
             "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
    fi
    
    # Log the notification
    log "Notification sent: $status - $message"
}

# Health check
health_check() {
    log "Performing health check"
    
    # Check MongoDB connection
    if mongosh "$MONGODB_URI" --eval "db.runCommand({ping: 1})" >/dev/null 2>&1; then
        log "MongoDB connection: OK"
    else
        error_exit "MongoDB connection failed"
    fi
    
    # Check disk space
    local available_space=$(df "$BACKUP_DIR" | awk 'NR==2 {print $4}')
    local required_space=1048576  # 1GB in KB
    
    if [[ $available_space -lt $required_space ]]; then
        error_exit "Insufficient disk space. Available: ${available_space}KB, Required: ${required_space}KB"
    fi
    
    log "Disk space check: OK (${available_space}KB available)"
}

# Main backup function
main() {
    log "=== WanRide Backup Started ==="
    
    # Perform checks
    check_env
    health_check
    create_backup_dir
    
    # Perform backup
    local backup_file
    backup_file=$(backup_mongodb)
    
    # Verify and upload
    verify_backup "$backup_file"
    upload_to_s3 "$backup_file"
    
    # Cleanup
    cleanup_old_backups
    
    # Success notification
    local backup_size=$(du -h "$backup_file" | cut -f1)
    send_notification "success" "Backup completed successfully. Size: $backup_size"
    
    log "=== WanRide Backup Completed Successfully ==="
}

# Error handling
trap 'send_notification "error" "Backup failed with error on line $LINENO"' ERR

# Run main function
main "$@"
