import { ethers } from 'hardhat'
import namehash from 'eth-ens-namehash'
import { Interface } from 'ethers/lib/utils'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { keccak256 } from 'js-sha3'

const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

const { makeInterfaceId } = require('@openzeppelin/test-helpers')
function computeInterfaceId(iface: Interface) {
  return makeInterfaceId.ERC165(
    Object.values(iface.functions).map((frag) => frag.format('sighash')),
  )
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer, owner } = await getNamedAccounts()

  const registry = await deployments.get('ENSRegistry')
  const registryContract = await ethers.getContractAt(
    registry.abi,
    registry.address,
  )

  const baseRegistrar = await deployments.get('BaseRegistrarImplementation')
  const baseRegistrarContract = await ethers.getContractAt(
    baseRegistrar.abi,
    baseRegistrar.address,
  )
  const registrar = await deployments.get('RemiliasRegistrar')
  const registrarContract = await ethers.getContractAt(
    registrar.abi,
    registrar.address,
  )

  const deployArgs = {
    from: deployer,
    args: [],
    log: true,
  }
  const OwnedResolver = await deploy('RemiliasResolver', deployArgs)
  const _OwnedResolver = await deployments.get('RemiliasResolver')
  const ownedResolver = await ethers.getContractAt(
    _OwnedResolver.abi,
    _OwnedResolver.address,
  )

  const remiliasHash = namehash.hash('remilias.eth')

  {
    const registrar = await deployments.get('RemiliasRegistrar')
    const artifact = await deployments.getArtifact('IRemiliasRegistrar')
    const interfaceId = computeInterfaceId(new Interface(artifact.abi))
    const implementer = await ownedResolver.interfaceImplementer(
      remiliasHash,
      interfaceId,
    )
    if (implementer !== registrar.address) {
      const tx = await ownedResolver.setInterface(
        remiliasHash,
        interfaceId,
        registrar.address,
      )
      console.log(
        `Setting IRemiliasRegistrar interface ID ${interfaceId} on remilias.eth resolver (tx: ${tx.hash})...`,
      )
      await tx.wait()
    }
  }

  {
    const RemiliasRegistrarController = await deployments.get(
      'RemiliasRegistrarController',
    )
    const artifact = await deployments.getArtifact(
      'IRemiliasRegistrarController',
    )
    const interfaceId = computeInterfaceId(new Interface(artifact.abi))
    const implementer = await ownedResolver.interfaceImplementer(
      remiliasHash,
      interfaceId,
    )
    if (implementer !== RemiliasRegistrarController.address) {
      const tx = await ownedResolver.setInterface(
        remiliasHash,
        interfaceId,
        RemiliasRegistrarController.address,
      )
      console.log(
        `Setting IRemiliasRegistrarController interface ID ${interfaceId} on remilias.eth resolver (tx: ${tx.hash})...`,
      )
      await tx.wait()
    }
  }
  {
    const NameWrapper = await deployments.get('RemiliasNameWrapper')
    const artifact = await deployments.getArtifact('IRemiliasNameWrapper')
    const interfaceId = computeInterfaceId(new Interface(artifact.abi))
    const implementer = await ownedResolver.interfaceImplementer(
      remiliasHash,
      interfaceId,
    )
    if (implementer !== NameWrapper.address) {
      const tx = await ownedResolver.setInterface(
        remiliasHash,
        interfaceId,
        NameWrapper.address,
      )
      console.log(
        `Setting IRemiliasNameWrapper interface ID ${interfaceId} on .eth resolver (tx: ${tx.hash})...`,
      )
      await tx.wait()
    }
  }

  const nodeResolver = await registryContract.resolver(remiliasHash)
  const nodeOwner = await registryContract.owner(remiliasHash)
  if (
    nodeResolver !== _OwnedResolver.address &&
    nodeOwner === owner
  ) {
    const tx = await registryContract.setResolver(remiliasHash, _OwnedResolver.address)
    console.log(
      `Setting resolver of remilias.eth node to RemiliasResolver (tx: ${tx.hash})...`,
    )
    await tx.wait()
  }

  const resolverAddr = await ownedResolver['addr(bytes32)'](remiliasHash)
  if (
    resolverAddr !== registrar.address &&
    nodeOwner === registrar.address &&
    nodeResolver === _OwnedResolver.address
  ) {
    const tx = await ownedResolver['setAddr(bytes32,address)'](
      remiliasHash,
      registrar.address,
    )
    console.log(`Setting address for remilias.eth to RemiliasRegistrar (tx: ${tx.hash})...`)
    await tx.wait()
  }

  if (owner !== deployer) {
    const tx = await ownedResolver.transferOwnership(owner)
    console.log(
      `Transferring ownership of OwnedResolver to owner (tx: ${tx.hash})...`,
    )
    await tx.wait()
  }
}

func.id = 'resolver'
func.tags = ['resolvers', 'RemiliasResolver']
func.dependencies = [
  'RemiliasRegistrar',
  'RemiliasRegistrarController',
  'RemiliasNameWrapper',
]
export default func
