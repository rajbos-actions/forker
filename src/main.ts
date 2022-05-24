import * as core from '@actions/core'
import {forkRepo, inviteMember, isOrgMember, isValidLicense} from './github'

export async function run(): Promise<void> {
  const owner: string = core.getInput('owner', {required: true})
  const repo: string = core.getInput('repo', {required: true})
  const org: string = core.getInput('org', {required: false})
  const user: string = core.getInput('user', {required: false})
  const addUser: boolean = core.getBooleanInput('addUser', {required: false})
  const licenseAllowlist: string[] = core.getMultilineInput(
    'licenseAllowlist',
    {
      required: false
    }
  )

  try {
    // Optionally enforce a whitelist of allowed repository licenses for forking
    if (!licenseAllowlist.includes('undefined')) {
      core.info(
        `⚖️ Checking repository license for ${repo} against provided whitelist...`
      )
      if (await isValidLicense(owner, repo, licenseAllowlist)) {
        core.info(`✅ Valid license, proceeding with fork creation`)
      } else {
        core.setFailed(
          `🚨 License not found in whitelist, please check to ensure the repository is compliant`
        )
      }
    }

    // Fork the specified repo into user namespace, unless an organization is specified
    core.info(`⑂ Creating fork of repository ${repo}...`)
    await forkRepo(owner, repo, org)

    // Optionally check org membership status for a specified user, and invite if missing
    if (addUser && typeof user !== 'undefined') {
      core.info(
        `🔍 Checking membership status of user ${user} in ${org} organization...`
      )
      if (await isOrgMember(org, user)) {
        core.info(
          `✅ User ${user} already a member of ${org}, no action needed`
        )
      } else {
        core.info(
          `📥 Inviting user ${user} to ${org} org, make sure they check their inbox!`
        )
        inviteMember(org, user)
      }
    }
  } catch (err) {
    core.info(`🚨 Error when forking the repo: ${err}`)
    core.setFailed(`🚨 Failed to create repository fork: ${err.message}`)
  }
}

run()
