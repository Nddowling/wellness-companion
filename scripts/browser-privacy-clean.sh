#!/usr/bin/env bash
# Browser Privacy Clean for macOS
#
# Strong browser-data cleanup without touching passwords, bookmarks, extensions,
# SSH records, print history, system logs, or other audit/system data.
#
# Usage:
#   ./scripts/browser-privacy-clean.sh --dry-run
#   ./scripts/browser-privacy-clean.sh --yes
#
# Notes:
#   - Quit browsers before cleaning for best results.
#   - Safari cleanup may need Full Disk Access for your terminal app.

set -u
set -o pipefail

DRY_RUN=1
ASSUME_YES=0
QUIT_BROWSERS=1
VERBOSE=0

deleted=0
missing=0
failed=0

usage() {
  cat <<'EOF'
Browser Privacy Clean for macOS

Options:
  --dry-run       Show what would be removed. Default.
  --yes          Actually remove browser data after confirmation bypass.
  --no-quit      Do not try to quit browsers first.
  --verbose      Print missing paths too.
  -h, --help     Show this help.

Preserves:
  saved passwords/keychain, bookmarks, extensions, browser preferences,
  SSH known_hosts, system logs, print history, and general app data.
EOF
}

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

warn() {
  printf '[WARN] %s\n' "$*" >&2
}

remove_path() {
  local path="$1"

  if [ -e "$path" ] || [ -L "$path" ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      printf '  would remove: %s\n' "$path"
    else
      if rm -rf "$path" 2>/dev/null; then
        printf '  removed: %s\n' "$path"
        deleted=$((deleted + 1))
      else
        warn "failed to remove: $path"
        failed=$((failed + 1))
      fi
    fi
  else
    missing=$((missing + 1))
    if [ "$VERBOSE" -eq 1 ]; then
      printf '  missing: %s\n' "$path"
    fi
  fi
}

clean_firefox_history_db() {
  local db="$1"

  [ -e "$db" ] || return 0

  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  would clear history while preserving bookmarks: %s\n' "$db"
    return 0
  fi

  if ! command -v sqlite3 >/dev/null 2>&1; then
    warn "sqlite3 unavailable; Firefox history not cleared: $db"
    failed=$((failed + 1))
    return 0
  fi

  if sqlite3 "$db" <<'SQL' >/dev/null 2>&1
PRAGMA busy_timeout=5000;
DELETE FROM moz_historyvisits;
DELETE FROM moz_inputhistory;
DELETE FROM moz_places
WHERE id NOT IN (SELECT fk FROM moz_bookmarks WHERE fk IS NOT NULL)
  AND url NOT LIKE 'place:%';
UPDATE moz_places SET visit_count = 0, last_visit_date = NULL;
SQL
  then
    printf '  cleared history, preserved bookmarks: %s\n' "$db"
    deleted=$((deleted + 1))
  else
    warn "failed to clear Firefox history database: $db"
    failed=$((failed + 1))
  fi
}

quit_browsers() {
  [ "$QUIT_BROWSERS" -eq 1 ] || return 0

  if [ "$DRY_RUN" -eq 1 ]; then
    log "Would quit open browsers before cleaning."
    return 0
  fi

  log "Quitting browsers..."
  local app
  for app in \
    "Safari" \
    "Google Chrome" \
    "Google Chrome Canary" \
    "Firefox" \
    "Microsoft Edge" \
    "Brave Browser" \
    "Arc" \
    "Opera" \
    "Vivaldi"; do
    osascript -e "quit app \"$app\"" >/dev/null 2>&1 || true
  done
  sleep 2
}

clean_chromium_profile() {
  local profile="$1"

  remove_path "$profile/History"
  remove_path "$profile/History-journal"
  remove_path "$profile/History Provider Cache"
  remove_path "$profile/Visited Links"
  remove_path "$profile/Top Sites"
  remove_path "$profile/Top Sites-journal"
  remove_path "$profile/Shortcuts"
  remove_path "$profile/Shortcuts-journal"
  remove_path "$profile/DownloadMetadata"
  remove_path "$profile/Network Action Predictor"
  remove_path "$profile/Network Action Predictor-journal"

  remove_path "$profile/Cookies"
  remove_path "$profile/Cookies-journal"

  remove_path "$profile/Current Session"
  remove_path "$profile/Current Tabs"
  remove_path "$profile/Last Session"
  remove_path "$profile/Last Tabs"
  remove_path "$profile/Sessions"
  remove_path "$profile/Session Storage"

  remove_path "$profile/Cache"
  remove_path "$profile/Code Cache"
  remove_path "$profile/GPUCache"
  remove_path "$profile/DawnCache"
  remove_path "$profile/GrShaderCache"
  remove_path "$profile/ShaderCache"
  remove_path "$profile/Media Cache"
  remove_path "$profile/Storage"
  remove_path "$profile/Local Storage"
  remove_path "$profile/IndexedDB"
  remove_path "$profile/Service Worker"
  remove_path "$profile/File System"
  remove_path "$profile/Shared Dictionary"
  remove_path "$profile/Platform Notifications"
  remove_path "$profile/Reporting and NEL"
  remove_path "$profile/Trust Tokens"
  remove_path "$profile/Trust Tokens-journal"
  remove_path "$profile/QuotaManager"
  remove_path "$profile/QuotaManager-journal"

  remove_path "$profile/Favicons"
  remove_path "$profile/Favicons-journal"
  remove_path "$profile/Thumbnails"
  remove_path "$profile/optimization_guide_hint_cache_store"
}

clean_chromium_root() {
  local label="$1"
  local root="$2"
  local cache="$3"

  [ -d "$root" ] || return 0

  log "Cleaning $label profiles..."
  local profile
  while IFS= read -r -d '' profile; do
    clean_chromium_profile "$profile"
  done < <(/usr/bin/find "$root" -maxdepth 1 -type d \( -name "Default" -o -name "Profile *" -o -name "Guest Profile" -o -name "System Profile" \) -print0 2>/dev/null)

  remove_path "$root/Crashpad"
  remove_path "$root/ShaderCache"
  remove_path "$root/GrShaderCache"
  remove_path "$root/DawnCache"
  remove_path "$root/CertificateRevocation"
  remove_path "$cache"
}

clean_firefox() {
  local root="$HOME/Library/Application Support/Firefox/Profiles"
  [ -d "$root" ] || return 0

  log "Cleaning Firefox profiles..."
  local profile
  while IFS= read -r -d '' profile; do
    clean_firefox_history_db "$profile/places.sqlite"
    remove_path "$profile/cookies.sqlite"
    remove_path "$profile/cookies.sqlite-wal"
    remove_path "$profile/cookies.sqlite-shm"
    remove_path "$profile/formhistory.sqlite"
    remove_path "$profile/formhistory.sqlite-wal"
    remove_path "$profile/downloads.sqlite"
    remove_path "$profile/sessionstore.jsonlz4"
    remove_path "$profile/sessionstore-backups"
    remove_path "$profile/cache2"
    remove_path "$profile/startupCache"
    remove_path "$profile/thumbnails"
    remove_path "$profile/storage/default"
    remove_path "$profile/storage/temporary"
    remove_path "$profile/datareporting"
    remove_path "$profile/minidumps"
    remove_path "$profile/saved-telemetry-pings"
    remove_path "$profile/webappsstore.sqlite"
    remove_path "$profile/favicons.sqlite"
    remove_path "$profile/favicons.sqlite-wal"
    remove_path "$profile/favicons.sqlite-shm"
  done < <(/usr/bin/find "$root" -maxdepth 1 -type d -print0 2>/dev/null)

  remove_path "$HOME/Library/Caches/Firefox"
  remove_path "$HOME/Library/Caches/Mozilla"
}

clean_safari() {
  log "Cleaning Safari..."

  remove_path "$HOME/Library/Safari/History.db"
  remove_path "$HOME/Library/Safari/History.db-wal"
  remove_path "$HOME/Library/Safari/History.db-shm"
  remove_path "$HOME/Library/Safari/History"
  remove_path "$HOME/Library/Safari/Downloads.plist"
  remove_path "$HOME/Library/Safari/LastSession.plist"
  remove_path "$HOME/Library/Safari/RecentlyClosedTabs.plist"
  remove_path "$HOME/Library/Safari/TopSites.plist"
  remove_path "$HOME/Library/Safari/SearchDescriptions.plist"
  remove_path "$HOME/Library/Safari/WebpageIcons.db"
  remove_path "$HOME/Library/Safari/WebpageIcons.db-wal"
  remove_path "$HOME/Library/Safari/WebpageIcons.db-shm"
  remove_path "$HOME/Library/Safari/Favicon Cache"

  remove_path "$HOME/Library/Safari/LocalStorage"
  remove_path "$HOME/Library/Safari/Databases"
  remove_path "$HOME/Library/Safari/OfflineWebApplicationCache"
  remove_path "$HOME/Library/Safari/Template Icons"
  remove_path "$HOME/Library/Safari/CloudTabs.db"
  remove_path "$HOME/Library/Safari/CloudTabs.db-wal"
  remove_path "$HOME/Library/Safari/CloudTabs.db-shm"

  remove_path "$HOME/Library/Cookies/Cookies.binarycookies"
  remove_path "$HOME/Library/Cookies/com.apple.Safari.SafeBrowsing.binarycookies"
  remove_path "$HOME/Library/Caches/com.apple.Safari"
  remove_path "$HOME/Library/Caches/com.apple.WebKit.Networking"
  remove_path "$HOME/Library/WebKit/com.apple.Safari"
  remove_path "$HOME/Library/Containers/com.apple.Safari/Data/Library/Caches"
  remove_path "$HOME/Library/Containers/com.apple.Safari/Data/Library/Cookies"
  remove_path "$HOME/Library/Containers/com.apple.Safari/Data/Library/WebKit"
}

clean_opera() {
  clean_chromium_root \
    "Opera" \
    "$HOME/Library/Application Support/com.operasoftware.Opera" \
    "$HOME/Library/Caches/com.operasoftware.Opera"
}

clean_vivaldi() {
  clean_chromium_root \
    "Vivaldi" \
    "$HOME/Library/Application Support/Vivaldi" \
    "$HOME/Library/Caches/Vivaldi"
}

clean_browser_artifacts() {
  log "Cleaning shared browser artifacts..."
  remove_path "$HOME/Library/Caches/Google"
  remove_path "$HOME/Library/Caches/BraveSoftware"
  remove_path "$HOME/Library/Caches/Microsoft Edge"
  remove_path "$HOME/Library/Caches/Arc"
  remove_path "$HOME/Library/Saved Application State/com.google.Chrome.savedState"
  remove_path "$HOME/Library/Saved Application State/com.brave.Browser.savedState"
  remove_path "$HOME/Library/Saved Application State/com.microsoft.edgemac.savedState"
  remove_path "$HOME/Library/Saved Application State/company.thebrowser.Browser.savedState"
  remove_path "$HOME/Library/Saved Application State/org.mozilla.firefox.savedState"
  remove_path "$HOME/Library/Saved Application State/com.apple.Safari.savedState"
}

flush_dns() {
  log "Flushing user-visible DNS cache..."
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  would run: dscacheutil -flushcache\n'
    printf '  would run: killall -HUP mDNSResponder\n'
    return 0
  fi

  dscacheutil -flushcache 2>/dev/null || warn "dscacheutil failed"
  killall -HUP mDNSResponder 2>/dev/null || warn "mDNSResponder signal failed"
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --dry-run)
        DRY_RUN=1
        ;;
      --yes)
        DRY_RUN=0
        ASSUME_YES=1
        ;;
      --no-quit)
        QUIT_BROWSERS=0
        ;;
      --verbose)
        VERBOSE=1
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        warn "Unknown option: $1"
        usage
        exit 2
        ;;
    esac
    shift
  done
}

confirm() {
  if [ "$DRY_RUN" -eq 1 ]; then
    log "Dry run only. Nothing will be deleted."
    return 0
  fi

  if [ "$ASSUME_YES" -eq 1 ]; then
    return 0
  fi

  printf 'This will delete browser history, cookies, sessions, caches, and site storage. Continue? Type yes: '
  local reply
  read -r reply
  if [ "$reply" != "yes" ]; then
    log "Aborted."
    exit 0
  fi
}

main() {
  parse_args "$@"

  log "Browser Privacy Clean for macOS"
  confirm
  quit_browsers

  clean_safari
  clean_chromium_root "Chrome" "$HOME/Library/Application Support/Google/Chrome" "$HOME/Library/Caches/Google/Chrome"
  clean_chromium_root "Chrome Canary" "$HOME/Library/Application Support/Google/Chrome Canary" "$HOME/Library/Caches/Google/Chrome Canary"
  clean_chromium_root "Microsoft Edge" "$HOME/Library/Application Support/Microsoft Edge" "$HOME/Library/Caches/Microsoft Edge"
  clean_chromium_root "Brave" "$HOME/Library/Application Support/BraveSoftware/Brave-Browser" "$HOME/Library/Caches/BraveSoftware/Brave-Browser"
  clean_chromium_root "Arc" "$HOME/Library/Application Support/Arc/User Data" "$HOME/Library/Caches/Arc"
  clean_opera
  clean_vivaldi
  clean_firefox
  clean_browser_artifacts
  flush_dns

  echo
  if [ "$DRY_RUN" -eq 1 ]; then
    log "Dry run complete. Run with --yes to actually clean."
  else
    log "Clean complete."
  fi
  log "Removed entries: $deleted | Missing/skipped: $missing | Failed: $failed"
  log "Preserved passwords, bookmarks, extensions, SSH known_hosts, system logs, and print history."
}

main "$@"
