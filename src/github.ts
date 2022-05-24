import * as core from '@actions/core'
import {Octokit} from '@octokit/rest'
import {HttpsProxyAgent} from 'https-proxy-agent'

const token: string = core.getInput('token', {required: true})
const targetInstanceUrl: string = core.getInput('targetInstanceUrl')
const httpsProxy: string = process.env.HTTPS_PROXY as string
const octokit = targetInstanceUrl ? new Octokit({
  auth: token,
  baseUrl: targetInstanceUrl,
    request: {
      agent: httpsProxy
        ? new HttpsProxyAgent(httpsProxy)
        : undefined,
    },
}) : new Octokit({
  auth: token,
})

export async function forkRepo(
  owner: string,
  repo: string,
  org?: string
): Promise<void> {
  try {
    const res = await octokit.request('POST /repos/{owner}/{repo}/forks', {
      owner,
      repo,
      organization: org ? org : ''
    })
    // Forks requests are still 'Accepted' (202) if the repository already exists at the specified location
    // However, repositories with the same name but a different source are auto-incremented (eg. my-forked-repo-1)
    if (res.status === 202) {
      // Regex to determine whether the repository ends with a dash and a number
      const regex = /-\d+$/
      const url = res.data.html_url
      if (regex.test(url)) {
        core.info(
          `⚠️ Warning: A repository with the same name may already exist at the target destination!`
        )
        core.info(
          `As a result, the new repository fork URL might be auto-incremented (eg. my-forked-repo-1).`
        )
        core.info(
          `If this was not intentional, please check for exisiting repositories on your Github account or organization!\n`
        )
      }
      core.info(`🎉 Forked repository now available at: ${res.data.html_url}`)
    }
  } catch (err) {
    if (err.status === 403) {
      core.setFailed(
        `🚨 Insufficient permission to fork repository: ${err.message}`
      )
    } else {
      core.info(`Received an error code: ${err.status}` + err.message)
      core.setFailed(`🚨 Failed to create fork of repository: ${repo}`)
    }
  }
}

export async function getOrgMembership(
  org: string,
  user: string
): Promise<string> {
  try {
    const res = await octokit.request('GET /orgs/{org}/members/{username}', {
      org,
      username: user
    })
    // @ts-expect-error only return membership URL if response code is 204
    if (res.status === 204) {
      return res.url
    } else {
      core.setFailed(
        `🚨 Failed to retrieve membership status for user: ${user}`
      )
      return ''
    }
  } catch (err) {
    if (err.status === 404) {
      core.debug(`User ${user} not found in ${org} organization`)
    } else if (err.status === 302) {
      core.setFailed(
        `🚨 Requester not a member of organization: ${err.message}`
      )
    } else {
      core.setFailed(
        `🚨 Failed to retrieve membership status for user: ${err.message}`
      )
    }
    return ''
  }
}

export async function getRepoLicense(
  owner: string,
  repo: string
): Promise<string> {
  try {
    const {data} = await octokit.request('GET /repos/{owner}/{repo}/license', {
      owner,
      repo
    })
    if (data !== null && data.license !== null) {
      return data.license.key
    } else {
      return ''
    }
  } catch (err) {
    core.setFailed(
      `🚨 Failed to retrieve license for repository: ${err.message}`
    )
    return ''
  }
}

export async function getUserId(user: string): Promise<string> {
  try {
    const {data} = await octokit.request('GET /users/{username}', {
      username: user
    })
    return data.id
  } catch (err) {
    core.setFailed(`🚨 Failed to retrieve user ID for user: ${err.message}`)
    return ''
  }
}

export async function inviteMember(org: string, user: string): Promise<void> {
  const id = await getUserId(user)
  const userId = Number.parseInt(id)
  core.debug(`Got user ID: ${userId}`)
  let data
  try {
    data = await octokit.request('POST /orgs/{org}/invitations', {
      org,
      invitee_id: userId
    })
    if (data.status === 201) {
      core.debug(`User successfully invited`)
    } else {
      core.debug(`Unable to validate invitation`)
      core.setFailed(`🚨 Failed to invite user to org: ${org}`)
    }
  } catch (err) {
    core.setFailed(`🚨 Failed to invite user to org: ${err.message}`)
  }
}

export async function isOrgMember(org: string, user: string): Promise<boolean> {
  const orgMembership = await getOrgMembership(org, user)
  core.debug(`Got org membership: ${orgMembership}`)
  return orgMembership ? true : false
}

export async function isValidLicense(
  owner: string,
  repo: string,
  whitelist: string[]
): Promise<boolean> {
  const repoLicense = await getRepoLicense(owner, repo)
  core.debug(`Got license: ${repoLicense}`)
  return whitelist.includes(repoLicense)
}
