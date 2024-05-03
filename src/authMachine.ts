import { NextRouter } from 'next/router';
import {
  ActorRefFrom,
  assign,
  DoneInvokeEvent,
  send,
  spawn,
  StateFrom
} from 'xstate';
import { createModel } from 'xstate/lib/model';
import { LoggedInUser } from './apiTypes';
import { notifMachine, notifModel } from './notificationMachine';
import {
  makeSourceMachine,
  SourceMachineActorRef,
  sourceModel
} from './sourceMachine';
import { SourceRegistryData } from './types';
import { callAPI, isSignedIn } from './utils';

const authModel = createModel(
  {
    notifRef: null! as ActorRefFrom<typeof notifMachine>,
    sourceRef: null as SourceMachineActorRef | null,
    loggedInUserData: null as LoggedInUser | null,
  },
  {
    events: {
      EXTERNAL_SIGN_IN: () => ({}),
      EXTERNAL_SIGN_OUT: () => ({}),
      SIGNED_IN: () => ({}),
      CHOOSE_PROVIDER: () => ({}),
      CANCEL_PROVIDER: () => ({}),
      LOGGED_OUT_USER_ATTEMPTED_RESTRICTED_ACTION: () => ({}),
    },
  },
);

export type AuthMachine = ReturnType<typeof createAuthMachine>;

export type AuthMachineState = StateFrom<AuthMachine>;

export const createAuthMachine = (params: {
  sourceRegistryData: SourceRegistryData | null;
  router: NextRouter;
  isEmbbeded: boolean;
}) => {
  return authModel.createMachine({
    preserveActionOrder: true,
    id: 'auth',
    initial: 'initializing',
    context: authModel.initialContext,
    entry: assign({
      notifRef: () => spawn(notifMachine),
    }),
    on: {
      SIGNED_IN: {
        target: 'signed_in',
        internal: true,
      },
    },
    states: {
      initializing: {
        entry: [
          authModel.assign((ctx) => {
            return {
              sourceRef: spawn(
                makeSourceMachine({
                  sourceRegistryData: params.sourceRegistryData,
                  router: params.router,
                  isEmbedded: params.isEmbbeded,
                }),
              ),
            };
          }),
        ],
        always: 'checking_if_signed_in',
      },
      checking_if_signed_in: {
        always: [
          {
            cond: () => isSignedIn(),
            target: 'signed_in',
          },
          {
            target: 'signed_out',
          },
        ],
      },
      external_sign_in: {
        entry: [
          (_) => {
          },
        ],
      },
      external_sign_out: {
        tags: ['authorized'],
        entry: [
          (_) => {

          },
        ],
      },
      signed_out: {
        on: {
          EXTERNAL_SIGN_IN: 'external_sign_in',
        },
        initial: 'idle',
        states: {
          idle: {},
        },
      },
      signed_in: {
        exit: [
          send(sourceModel.events.LOGGED_IN_USER_ID_UPDATED(null), {
            to: (ctx) => ctx.sourceRef!,
          }),
        ],
        tags: ['authorized'],
        on: {
          EXTERNAL_SIGN_OUT: 'external_sign_out',
        },
        initial: 'fetchingUser',
        states: {
          fetchingUser: {
            invoke: {
              src: (_): Promise<LoggedInUser> =>
                callAPI<LoggedInUser>({
                  endpoint: 'get-user',
                }).then((res) => res.data),
              onDone: {
                target: 'idle',
                actions: [
                  assign((_, event: DoneInvokeEvent<LoggedInUser>) => {
                    return {
                      loggedInUserData: event.data,
                    };
                  }),
                  send(
                    (_, event: DoneInvokeEvent<LoggedInUser>) => {
                      return sourceModel.events.LOGGED_IN_USER_ID_UPDATED(
                        event.data.id,
                      );
                    },
                    {
                      to: (ctx) => ctx.sourceRef!,
                    },
                  ),
                ],
              },
              onError: {
                target: 'idle',
                actions: [
                  send(
                    notifModel.events.BROADCAST(
                      `Could not load your user's details. Some things may not work as expected. Reload the page to retry.`,
                      'error',
                    ),
                    {
                      to: (ctx) => ctx.notifRef,
                    },
                  ),
                ],
              },
            },
          },
          idle: {},
        },
      },
      signing_in: {
        entry: 'signInUser',
        type: 'final',
        meta: {
          description: `
            Calling signInUser redirects us away from this
            page - this is modelled as a final state because
            the state machine is stopped and recreated when
            the user gets redirected back.
          `,
        },
      },
    },
  });
};