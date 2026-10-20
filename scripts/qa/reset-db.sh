#!/usr/bin/env bash
# Drops and recreates the local QA database. Dev servers reconnect and re-migrate on next request.
set -e
DB=${1:-labcs}
su postgres -c "psql -q -c \"select pg_terminate_backend(pid) from pg_stat_activity where datname='$DB' and pid <> pg_backend_pid();\"" >/dev/null
su postgres -c "psql -q -c 'drop database if exists $DB;'"
su postgres -c "psql -q -c 'create database $DB;'"
echo "reset $DB"
