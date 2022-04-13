#!/bin/bash
# Helping Hands Deploy Script
# ./deploy.sh {dev|prod}

TARGET_PROJECT=""

DEV_PROJECT="helping-hands-development"
PROD_PROJECT="helping-hands-community"

CURR_PROJECT=$(grep \"$(pwd)\" ~/.config/configstore/firebase-tools.json | cut -d'"' -f4)
CURR_USER=$(grep \"email\" ~/.config/configstore/firebase-tools.json | cut -d'"' -f4)
CURR_AUTH_EXP=$(grep \"exp\" ~/.config/configstore/firebase-tools.json | cut -d":" -f2 | tr -d ' ')
START_COMMIT=$(git rev-parse HEAD)
CURR_COMMIT=$START_COMMIT
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
GIT_COMMIT_BASE="https://github.com/Helping-Hands-Now/web/commit/"
GIT_BRANCH_BASE="https://github.com/Helping-Hands-Now/web/tree/"
PUSH_IT_EASTER_EGG="https://www.youtube.com/watch?v=vCadcBR95oU"

unset CLOWNTOWN_POPULATION

trap USER_REQUESTED_ABORT SIGINT

USER_REQUESTED_ABORT() {
  printf '\nUser requested abort!'
  if [[ ! -z $DEPLOY_STARTED ]]
  then
    printf ' Sending Slack notification...'
    SEND_SLACK_MESSAGE Canceled
  fi
  printf ' Exiting!\n'
  exit 1
}

PRINT_USAGE() {
  echo "Usage: $0 environment"
  echo "Valid environments: dev, prod"
  exit 0
}

THANKS_BYE() {
  printf "\n🦺 Thanks for being safe! 🦺\n"
  EXIT_HANDLER 0
}

CHECK_RETURN_CODE() {
  if [[ $? -ne 0 ]]
  then
    echo "Error: Command returned non-zero exit code. Aborting."
    EXIT_HANDLER 254
  fi
}

CHECK_CURR_COMMIT() {
  WORKING_CHANGES="$(git status --porcelain)"
  if [[ ! -z "$WORKING_CHANGES" ]]
  then
    echo "$WORKING_CHANGES"
    echo "Error: Working directory is not clean. Please commit your work and try again!"
    EXIT_HANDLER 252
  fi
  CURR_COMMIT=$(git rev-parse HEAD)
  CHECK_RETURN_CODE
  if [[ "$START_COMMIT" != "$CURR_COMMIT" ]]
  then
    echo "Error: Current HEAD changed during script execution! Cowardly refusing to continue."
    EXIT_HANDLER 253
  fi
}

CHECK_FIREBASE_AUTH() {
  if [[ -z $CURR_AUTH_EXP ]] || [[ ! $CURR_AUTH_EXP =~ ^[0-9]*$ ]]
  then
    firebase login
    CURR_USER=$(grep \"email\" ~/.config/configstore/firebase-tools.json | cut -d'"' -f4)
    CURR_AUTH_EXP=$(grep \"exp\" ~/.config/configstore/firebase-tools.json | cut -d":" -f2 | tr -d ' ')
  elif [[ $(expr $CURR_AUTH_EXP - 300) -lt $(date +%s) ]]
  then
    firebase login --reauth
    CURR_USER=$(grep \"email\" ~/.config/configstore/firebase-tools.json | cut -d'"' -f4)
    CURR_AUTH_EXP=$(grep \"exp\" ~/.config/configstore/firebase-tools.json | cut -d":" -f2 | tr -d ' ')
  else
    echo "Logged into Firebase as: $CURR_USER"
  fi
}

CHECK_SSH_AGENT() {
  if [[ -z $SSH_AGENT_PID ]] || [[ -z $SSH_AUTH_SOCK ]]
  then
    printf "\nCould not detect valid ssh-agent in environment!\n"
    echo "It is recommended to run ssh-agent for production pushes."
    echo "This eliminates the need to put in your password every time."
    echo
    read -ep "Start ssh-agent (Yes/No)? " response
    if [[ "$response" == "Yes" ]]
    then
      SSH_AGENT_STRING=`ssh-agent -s`
      eval $SSH_AGENT_STRING
      ssh-add -K
      echo "Please paste this into your active shell(s) after deploying:"
      echo
      echo "$SSH_AGENT_STRING"
      echo
      read -n 1 -s -r -p "(Press any key to continue)" && printf '\n'
    fi
  fi
}

CHECK_PRODUCTION_BRANCH() {
  if [[ ! -z $GIT_BRANCH ]] && [[ "$GIT_BRANCH" == "production" ]]
  then
    LATEST_REMOTE_PRODUCTION_COMMIT=$(git ls-remote -h origin production | cut -f1)
    CHECK_RETURN_CODE
    CHECK_CURR_COMMIT
    if [[ "$CURR_COMMIT" == "$LATEST_REMOTE_PRODUCTION_COMMIT" ]]
    then
      printf "\n🙌 Confirmed Production branch is up to date. 🙌\n\n"
    else
      BASE_LOCAL_PRODUCTION_COMMIT=$(git merge-base production origin/production)
      CHECK_RETURN_CODE
      if [[ "$LATEST_REMOTE_PRODUCTION_BRANCH" == "$BASE_LOCAL_PRODUCTION_COMMIT" ]]
      then
        printf "\n🤔 You are deploying Production but your branch is out of date. 🤔\n\n"
        echo "It appears you are pushing an older commit than is currently on origin/production!"
        echo "Latest production commit is: $LATEST_REMOTE_PRODUCTION_BRANCH"
        echo "Target production commit is: $CURR_COMMIT"
        echo
        read -ep "Please type Confirm to continue: " response
        if [[ "$response" == "Confirm" ]]
        then
          CLOWNTOWN_POPULATION="🤡"
          echo "🤡 Ok that's a little clowny. But okie dokie! 🤡"
        else
          THANKS_BYE
        fi
      else
        printf "\n🧐 You are deploying Production but you have not pushed this commit to origin. 🧐\n\n"
        echo "Cowardly refusing to continue. You must push your commit to the repository first."
        echo "Error: Please run 'git push origin production' and try again!"
        EXIT_HANDLER 7
      fi
    fi
  else
    printf "\n⚠️  You are deploying Production but not pushing from the production branch! ⚠️\n\n"
    echo "Deploying from branch: $GIT_BRANCH"
    echo "Target commit is: $CURR_COMMIT"
    echo
    echo "*** WARNING: Production branch sanity checks are DISABLED! Proceed with great caution."
    echo
    read -ep "Please type Enter Clowntown to continue: " response
    if [[ "$response" == "Enter Clowntown" ]]
    then
      CLOWNTOWN_POPULATION="🤡🤡🤡"
      printf "\n🤡🤡🤡 Welcome to Clowntown. Population: You! 🤡🤡🤡\n\n"
      echo "Waiting 10 seconds so you can think about what you are about to do..."
      sleep 10
      printf "\n🤞 Here we go! 🤞\n\n"
    else
      THANKS_BYE
    fi
  fi
}

EXIT_HANDLER() {
  if [[ ! -z $DEPLOY_STARTED ]]
  then
    SEND_SLACK_MESSAGE Aborting
  fi
  if [[ ! -z $1 ]]
  then
    exit $1
  else
    exit 255
  fi
}

SEND_SLACK_MESSAGE() {
  if [[ -z $1 ]] || [[ ! "$1" =~ ^(Beginning|Finalizing|Aborting|Canceled)$ ]]
  then
    echo "Error: Called SEND_SLACK_MESSAGE without required argument."
  fi
  if [[ "$1" == "Beginning" ]]
  then
    DEPLOY_STARTED=$(date +%s)
  fi
  if [[ "$PROD_PROJECT" == "$TARGET_PROJECT" ]]
  then
    MESSAGE="[$CURR_USER] $1 ${CLOWNTOWN_POPULATION+$CLOWNTOWN_POPULATION" "}deployment to 🔥 <$PUSH_IT_EASTER_EGG|Production> 🔥 environment from \`<$GIT_BRANCH_BASE$GIT_BRANCH|$GIT_BRANCH>\`${CLOWNTOWN_POPULATION+" "$CLOWNTOWN_POPULATION}: \`<$GIT_COMMIT_BASE$CURR_COMMIT|$(echo $CURR_COMMIT | cut -c 1-8)>\` => $TARGET_PROJECT"
  elif [[ "$DEV_PROJECT" == "$TARGET_PROJECT" ]]
  then
    MESSAGE="[$CURR_USER] $1 deployment to 👷 Development 👷 environment from \`<$GIT_BRANCH_BASE$GIT_BRANCH|$GIT_BRANCH>\`: \`<$GIT_COMMIT_BASE$CURR_COMMIT|$(echo $CURR_COMMIT | cut -c 1-8)>\` => $TARGET_PROJECT"
  else
    echo "Error: No valid TARGET_PROJECT found for Slack message. Aborting."
    EXIT_HANDLER 6
  fi
  curl -X POST -H 'Content-type: application/json' --data "{\"text\":\"$MESSAGE\"}" https://hooks.slack.com/services/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 >/dev/null 2>&1
}

CHECK_BUILD_TARGET() {
  BUILD_TARGET=$(cat ./src/config/env.js | cut -d"'" -f 4)
  if [[ "$TARGET_PROJECT" != "$BUILD_TARGET" ]]
  then
    echo "Error: BUILD_TARGET is incorrect (currently $BUILD_TARGET but should be $TARGET_PROJECT). Aborting!"
    EXIT_HANDLER 251
  fi
}

UPDATE_BUILD_TARGET() {
  echo "module.exports = { 'build_target': '$TARGET_PROJECT' };" > ./src/config/env.js
  yarn update-commit
  CHECK_RETURN_CODE
}

UPDATE_RUNTIMECONFIG() {
  firebase functions:config:get > ./functions/.runtimeconfig.json
  CHECK_RETURN_CODE
}

USE_PROJECT() {
  if [[ -z "$1" ]] || [[ ! "$1" =~ ^($DEV_PROJECT|$PROD_PROJECT)$ ]]
  then
    echo "Error: USE_PROJECT() requires a valid firebase project as argument."
    EXIT_HANDLER 2
  fi
  if [[ "$1" =~ ^($DEV_PROJECT|$PROD_PROJECT)$ ]]
  then
    if [[ "$CURR_PROJECT" == "$1" ]]
    then
      echo "Firebase project is already set to: $1"
    else
      echo "Setting firebase project to: $1..."
      firebase use $1
      CHECK_RETURN_CODE
      UPDATE_RUNTIMECONFIG
      UPDATE_BUILD_TARGET
      NEW_PROJECT=$(grep \"$(pwd)\" ~/.config/configstore/firebase-tools.json | cut -d'"' -f4)
      if [[ "$NEW_PROJECT" == "$1" ]]
      then
        echo "Successfully set firebase project!"
        CURR_PROJECT=$NEW_PROJECT
      else
        echo "Error: Failed to set firebase project! Aborting."
        EXIT_HANDLER 3
      fi
    fi
  else
    echo "Error: could not find current firebase project."
    echo "Are you running deploy from the project root directory?"
    EXIT_HANDLER 4
  fi
}

if [[ "$#" -eq 1 ]] && [[ ! -z "$1" ]] && [[ "$1" =~ ^(dev|development|prod|production)$ ]]
then
  CHECK_CURR_COMMIT
  CHECK_FIREBASE_AUTH
  if [[ "$1" =~ ^(dev|development)$ ]]
  then
    TARGET_PROJECT=$DEV_PROJECT
    USE_PROJECT $DEV_PROJECT
    if [[ "$CURR_PROJECT" == "$TARGET_PROJECT" ]]
    then
      CHECK_CURR_COMMIT
      echo "Deploying from branch: $GIT_BRANCH"
      echo "Target commit is: $CURR_COMMIT"
      CHECK_BUILD_TARGET
      SEND_SLACK_MESSAGE Beginning
      echo "Starting yarn build..."
      yarn build
      CHECK_RETURN_CODE
      CHECK_BUILD_TARGET
      echo "Starting firebase deploy..."
      firebase deploy
      CHECK_RETURN_CODE
      SEND_SLACK_MESSAGE Finalizing
    fi
  elif [[ "$1" =~ ^(prod|production) ]]
  then
    printf "\n🔥 Caution you have selected a deploy to PRODUCTION. 🔥\n\n"
    CHECK_CURR_COMMIT
    echo "Deploying from branch: $GIT_BRANCH"
    echo "Target commit is: $CURR_COMMIT"
    echo
    read -ep "Are you sure (Yes/No)? " response
    if [[ "$response" == "Yes" ]]
    then
      printf "\n🚀 Confirmed. Initiating PRODUCTION deploy! 🚀\n\n"
      TARGET_PROJECT=$PROD_PROJECT
      USE_PROJECT $PROD_PROJECT
      if [[ "$CURR_PROJECT" == "$TARGET_PROJECT" ]]
      then
        CHECK_SSH_AGENT
        CHECK_PRODUCTION_BRANCH
        CHECK_BUILD_TARGET
        SEND_SLACK_MESSAGE Beginning
        echo "Starting yarn build..."
        yarn build
        CHECK_RETURN_CODE
        CHECK_BUILD_TARGET
        echo "Starting firebase deploy..."
        firebase deploy
        CHECK_RETURN_CODE
        SEND_SLACK_MESSAGE Finalizing
      else
        echo "Error: Project mis-match during deploy! This shouldn't ever happen."
        echo "Please report this error to someone who can help!"
        EXIT_HANDLER 5
      fi
    else
      THANKS_BYE
    fi
  else
    PRINT_USAGE
  fi
  else
    PRINT_USAGE
fi

echo "Done! Thank you for using the Helping Hands deploy script."
