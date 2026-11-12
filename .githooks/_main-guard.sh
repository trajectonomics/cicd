#!/bin/sh
# Shared by the Direct-commit guard hooks; see README "Guarding main without
# branch protection". An accident guard, not branch protection: --no-verify, an
# unactivated clone, the web UI and the API all bypass it.
#
# The hooks exec this file, so a missing or non-executable copy refuses a commit
# or push instead of silently allowing one.

refuse_main() {
	cat >&2 <<'MESSAGE'
Direct changes to main are not allowed. Create `feat/*`, `fix/*` or `docs/*` and open a PR.
MESSAGE
	exit 1
}

case "$1" in
branch)
	# pre-commit and pre-merge-commit: a detached HEAD is allowed, because a
	# rebase commits there.
	case "$(git symbolic-ref -q --short HEAD)" in
	main | master) refuse_main ;;
	esac
	;;
push)
	# pre-push: every remote ref git handed the hook on stdin.
	while read -r _local_ref _local_sha remote_ref _remote_sha; do
		case "$remote_ref" in
		refs/heads/main | refs/heads/master) refuse_main ;;
		esac
	done
	;;
esac
